/**
 * Scheduler - Pipeline runner using node-cron
 * Orchestrates fetching, filtering, and storing alerts
 */
import cron from 'node-cron';
import { fetchCISAAlerts, FetchedAlert } from './fetchers/cisa.js';
import { fetchRBIAlerts } from './fetchers/rbi.js';
import { fetchWeatherAlerts } from './fetchers/weather.js';
import { fetchRSSNews, RSSArticle } from './fetchers/rssNews.js';
import { filterAlert, RawAlert } from './aiFilter.js';
import { areAlertsSimilar } from './normalize.js';
import { supabase } from './supabaseClient.js';

interface UserLocation {
  id: string;
  location_lat: number;
  location_lng: number;
}

/**
 * Check if an alert is semantically similar to existing alerts
 */
async function isSimilarToExisting(alert: FetchedAlert): Promise<boolean> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentAlerts } = await supabase
    .from('incidents')
    .select('id, title, description, location_lat, location_lng')
    .eq('source', alert.source)
    .gte('created_at', weekAgo)
    .limit(50);

  if (!recentAlerts || recentAlerts.length === 0) return false;

  for (const existing of recentAlerts) {
    if (areAlertsSimilar(
      { title: alert.title, description: alert.description },
      existing
    )) {
      console.log(`[Pipeline] Skipping similar alert: "${alert.title.substring(0, 50)}..."`);
      return true;
    }
  }

  return false;
}

/**
 * Upsert alerts directly to the database (for new fetcher format)
 * Now includes semantic deduplication
 */
async function upsertAlerts(alerts: (FetchedAlert | RSSArticle)[]): Promise<number> {
  if (alerts.length === 0) return 0;

  let inserted = 0;
  for (const alert of alerts) {
    try {
      // Check if alert already exists by external_id
      const { data: existing } = await supabase
        .from('incidents')
        .select('id')
        .eq('external_id', alert.external_id)
        .single();

      // Extract article_url and image_url if present (RSS articles)
      const articleUrl = 'article_url' in alert ? alert.article_url : null;
      const imageUrl = 'image_url' in alert ? alert.image_url : null;

      if (existing) {
        // Update existing alert
        await supabase
          .from('incidents')
          .update({
            title: alert.title,
            description: alert.description,
            category: alert.category.toUpperCase(),
            severity: alert.severity.toUpperCase(),
            source: alert.source,
            source_url: alert.source_url,
            verified: alert.verified,
            ai_processed: alert.ai_processed,
            expires_at: alert.expires_at,
            ...(articleUrl && { article_url: articleUrl }),
            ...(imageUrl && { image_url: imageUrl }),
          })
          .eq('id', existing.id);
      } else {
        // Check semantic similarity before inserting
        const isSimilar = await isSimilarToExisting(alert as FetchedAlert);
        if (isSimilar) continue;

        // Insert new alert
        const { error } = await supabase.from('incidents').insert({
          external_id: alert.external_id,
          title: alert.title,
          description: alert.description,
          category: alert.category.toUpperCase(),
          severity: alert.severity.toUpperCase(),
          source: alert.source,
          source_url: alert.source_url,
          verified: alert.verified,
          ai_processed: alert.ai_processed,
          expires_at: alert.expires_at,
          ...(articleUrl && { article_url: articleUrl }),
          ...(imageUrl && { image_url: imageUrl }),
        });

        if (!error) inserted++;
      }
    } catch (err) {
      console.error(`[Pipeline] Error upserting alert ${alert.external_id}:`, err);
    }
  }

  return inserted;
}

/**
 * Run AI filter on unprocessed alerts
 */
async function runAIFilter(): Promise<void> {
  try {
    const { data: unprocessed } = await supabase
      .from('incidents')
      .select('*')
      .eq('ai_processed', false)
      .limit(20);

    if (!unprocessed || unprocessed.length === 0) {
      console.log('[Pipeline] No unprocessed alerts to filter');
      return;
    }

    console.log(`[Pipeline] Running AI filter on ${unprocessed.length} alerts`);

    for (const incident of unprocessed) {
      try {
        // Pass existing location if available
        const existingLocation = incident.location_lat && incident.location_lng
          ? { lat: incident.location_lat, lng: incident.location_lng }
          : undefined;

        const rawAlert: RawAlert = {
          title: incident.title,
          description: incident.description,
          source: incident.source,
          sourceUrl: incident.source_url,
          location: existingLocation,
        };

        const filtered = await filterAlert(rawAlert);

        // Prepare update object
        const updateData: Record<string, any> = {
          category: filtered.category,
          severity: filtered.severity,
          verified: filtered.verified,
          ai_confidence: filtered.aiConfidence,
          action_step: filtered.actionStep || null,
          steps: filtered.steps ? JSON.stringify(filtered.steps) : null,
          ai_processed: true,
        };

        // Add extracted location if we found one and alert doesn't have location
        if (filtered.extractedLocation && !existingLocation) {
          updateData.location_lat = filtered.extractedLocation.lat;
          updateData.location_lng = filtered.extractedLocation.lng;
          updateData.location_radius = 50; // City-level radius in km
          console.log(`[Pipeline] Extracted location for ${incident.id}: ${filtered.extractedLocation.locationName} (${filtered.extractedLocation.lat}, ${filtered.extractedLocation.lng})`);
        }

        await supabase
          .from('incidents')
          .update(updateData)
          .eq('id', incident.id);
      } catch (err) {
        console.error(`[Pipeline] AI filter error for ${incident.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[Pipeline] AI filter batch error:', err);
  }
}

/**
 * Clean up existing duplicates in the database
 * Keeps the oldest entry for each group of similar alerts
 */
async function cleanupDuplicates(): Promise<number> {
  console.log('[Pipeline] Cleaning up duplicate alerts...');
  
  const { data: allAlerts } = await supabase
    .from('incidents')
    .select('id, title, description, source, created_at, location_lat, location_lng')
    .order('created_at', { ascending: true });

  if (!allAlerts || allAlerts.length === 0) return 0;

  const toDelete: string[] = [];
  const seen: Array<{ id: string; title: string; description: string; source: string; location_lat: number | null; location_lng: number | null }> = [];

  for (const alert of allAlerts) {
    // Check if similar to any seen alert from same source
    let isDuplicate = false;
    for (const existing of seen) {
      if (existing.source === alert.source) {
        if (areAlertsSimilar(
          { title: alert.title, description: alert.description, locationLat: alert.location_lat, locationLng: alert.location_lng },
          existing
        )) {
          toDelete.push(alert.id);
          isDuplicate = true;
          break;
        }
      }
    }

    if (!isDuplicate) {
      seen.push(alert);
    }
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('incidents')
      .delete()
      .in('id', toDelete);

    if (error) {
      console.error('[Pipeline] Error deleting duplicates:', error);
      return 0;
    }

    console.log(`[Pipeline] Removed ${toDelete.length} duplicate alerts`);
  }

  return toDelete.length;
}

/**
 * Process users in batches to avoid Open-Meteo rate limits
 * 50 users per batch with 1 second delay between batches
 */
async function fetchWeatherInBatches(users: UserLocation[]): Promise<FetchedAlert[]> {
  const BATCH_SIZE = 50;
  const DELAY_MS = 1000;
  const allAlerts: FetchedAlert[] = [];

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((user) =>
        fetchWeatherAlerts(user.location_lat, user.location_lng, user.id)
      )
    );

    const alerts = results
      .filter((r): r is PromiseFulfilledResult<FetchedAlert[]> => r.status === 'fulfilled')
      .flatMap((r) => r.value);

    allAlerts.push(...alerts);

    // Wait between batches to avoid rate limiting
    if (i + BATCH_SIZE < users.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  return allAlerts;
}

/**
 * Run the full pipeline - fetch from all sources
 */
async function runPipeline(): Promise<void> {
  console.log('[Pipeline] Starting...');

  try {
    // Run all non-weather fetchers in parallel
    const results = await Promise.allSettled([
      fetchCISAAlerts(),
      fetchRBIAlerts(),
      fetchRSSNews(),
    ]);

    const globalAlerts: (FetchedAlert | RSSArticle)[] = results
      .filter((r): r is PromiseFulfilledResult<(FetchedAlert | RSSArticle)[]> => r.status === 'fulfilled')
      .flatMap((r) => r.value);

    // Upsert global alerts first
    await upsertAlerts(globalAlerts);
    console.log(`[Pipeline] Global alerts upserted: ${globalAlerts.length}`);

    // Fetch all users who have a valid location set
    const { data: users, error } = await supabase
      .from('users')
      .select('id, location_lat, location_lng')
      .not('location_lat', 'is', null)
      .not('location_lng', 'is', null);

    if (error) {
      console.error('[Pipeline] Failed to fetch users:', error.message);
    } else {
      // Filter out invalid locations (0,0 is middle of the ocean, or out of valid range)
      const validUsers = (users as UserLocation[]).filter(
        (u) => 
          !(u.location_lat === 0 && u.location_lng === 0) &&
          u.location_lat >= -90 && u.location_lat <= 90 &&
          u.location_lng >= -180 && u.location_lng <= 180
      );

      console.log(`[Pipeline] Fetching weather for ${validUsers.length} users`);

      // Fetch weather for all users in batches
      const weatherAlerts = await fetchWeatherInBatches(validUsers);

      if (weatherAlerts.length > 0) {
        await upsertAlerts(weatherAlerts);
        console.log(`[Pipeline] Weather alerts upserted: ${weatherAlerts.length}`);
      }
    }

    // Run AI filter on all unprocessed incidents
    await runAIFilter();

    console.log('[Pipeline] Complete');
  } catch (err) {
    console.error('[Pipeline] Error:', err);
  }
}

/**
 * Run all pipelines
 */
export async function runAllPipelines(): Promise<void> {
  console.log('🔄 Running alert pipelines...');
  await runPipeline();
  console.log('✅ Pipelines complete');
}

/**
 * Start the scheduler with cron jobs
 */
export function startScheduler(): void {
  // Run cleanup and initial fetch on startup (with delay)
  setTimeout(async () => {
    try {
      await cleanupDuplicates();
      await runAllPipelines();
    } catch (err) {
      console.error('Initial pipeline run failed:', err);
    }
  }, 5000);

  // All fetchers (including per-user weather): Every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('⏰ Scheduled pipeline fetch');
    await runPipeline();
  });

  // Cleanup duplicates daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('⏰ Scheduled duplicate cleanup');
    await cleanupDuplicates();
  });

  console.log('📅 Scheduler started');
  console.log('   - All fetchers: every 30 minutes');
  console.log('   - Duplicate cleanup: daily at 3 AM');
}

export default { startScheduler, runAllPipelines, cleanupDuplicates };
