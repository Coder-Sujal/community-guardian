import { Router, Response } from 'express';
import { supabase } from '../db/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, HIGH: 0, MEDIUM: 1, LOW: 2 };
const NATIONAL_SOURCES = ['CISA', 'CERT-In', 'RBI', 'Open-Meteo', 'The Hacker News', 'BleepingComputer', 'Krebs on Security'];

// India-focused news sources — shown to users located in India, location-filtered for others
const INDIA_NEWS_SOURCES = ['NDTV', 'Times of India', 'The Hindu', 'Indian Express', 'Hindustan Times'];

// Bounding box for India (rough)
const INDIA_BOUNDS = { latMin: 6.5, latMax: 37.5, lngMin: 68.0, lngMax: 97.5 };

// Default radius in km for "near me" filtering
const DEFAULT_RADIUS_KM = 100;

// Known locations for text-based matching (expanded list)
const KNOWN_LOCATIONS: Array<{ names: string[]; lat: number; lng: number }> = [
  // India — major cities
  { names: ['bengaluru', 'bangalore', 'karnataka'], lat: 12.9716, lng: 77.5946 },
  { names: ['mumbai', 'bombay', 'maharashtra'], lat: 19.0760, lng: 72.8777 },
  { names: ['delhi', 'new delhi', 'ncr'], lat: 28.6139, lng: 77.2090 },
  { names: ['chennai', 'madras', 'tamil nadu'], lat: 13.0827, lng: 80.2707 },
  { names: ['kolkata', 'calcutta', 'west bengal'], lat: 22.5726, lng: 88.3639 },
  { names: ['hyderabad', 'telangana'], lat: 17.3850, lng: 78.4867 },
  { names: ['pune', 'poona'], lat: 18.5204, lng: 73.8567 },
  { names: ['ahmedabad', 'gujarat'], lat: 23.0225, lng: 72.5714 },
  { names: ['jaipur', 'rajasthan'], lat: 26.9124, lng: 75.7873 },
  { names: ['lucknow', 'uttar pradesh'], lat: 26.8467, lng: 80.9462 },
  // India — additional cities and states
  { names: ['chandigarh', 'punjab', 'haryana'], lat: 30.7333, lng: 76.7794 },
  { names: ['bhopal', 'madhya pradesh'], lat: 23.2599, lng: 77.4126 },
  { names: ['patna', 'bihar'], lat: 25.6093, lng: 85.1376 },
  { names: ['thiruvananthapuram', 'trivandrum', 'kerala'], lat: 8.5241, lng: 76.9366 },
  { names: ['kochi', 'cochin'], lat: 9.9312, lng: 76.2673 },
  { names: ['guwahati', 'assam'], lat: 26.1445, lng: 91.7362 },
  { names: ['bhubaneswar', 'odisha', 'orissa'], lat: 20.2961, lng: 85.8245 },
  { names: ['visakhapatnam', 'vizag', 'andhra pradesh'], lat: 17.6868, lng: 83.2185 },
  { names: ['indore'], lat: 22.7196, lng: 75.8577 },
  { names: ['nagpur'], lat: 21.1458, lng: 79.0882 },
  { names: ['coimbatore'], lat: 11.0168, lng: 76.9558 },
  { names: ['surat'], lat: 21.1702, lng: 72.8311 },
  { names: ['vadodara', 'baroda'], lat: 22.3072, lng: 73.1812 },
  { names: ['ranchi', 'jharkhand'], lat: 23.3441, lng: 85.3096 },
  { names: ['dehradun', 'uttarakhand'], lat: 30.3165, lng: 78.0322 },
  { names: ['shimla', 'himachal pradesh'], lat: 31.1048, lng: 77.1734 },
  { names: ['srinagar', 'jammu', 'kashmir'], lat: 34.0837, lng: 74.7973 },
  { names: ['goa', 'panaji'], lat: 15.4909, lng: 73.8278 },
  { names: ['raipur', 'chhattisgarh'], lat: 21.2514, lng: 81.6296 },
  { names: ['noida', 'ghaziabad', 'greater noida'], lat: 28.5355, lng: 77.3910 },
  { names: ['gurugram', 'gurgaon'], lat: 28.4595, lng: 77.0266 },
  { names: ['mysuru', 'mysore'], lat: 12.2958, lng: 76.6394 },
  // US
  { names: ['new york', 'nyc', 'manhattan', 'brooklyn'], lat: 40.7128, lng: -74.0060 },
  { names: ['los angeles', 'la', 'california', 'socal'], lat: 34.0522, lng: -118.2437 },
  { names: ['chicago', 'illinois'], lat: 41.8781, lng: -87.6298 },
  { names: ['houston', 'texas'], lat: 29.7604, lng: -95.3698 },
  { names: ['san francisco', 'sf', 'bay area'], lat: 37.7749, lng: -122.4194 },
  { names: ['seattle', 'washington'], lat: 47.6062, lng: -122.3321 },
  { names: ['miami', 'florida'], lat: 25.7617, lng: -80.1918 },
  { names: ['boston', 'massachusetts'], lat: 42.3601, lng: -71.0589 },
  // UK
  { names: ['london', 'uk', 'england'], lat: 51.5074, lng: -0.1278 },
  { names: ['manchester'], lat: 53.4808, lng: -2.2426 },
  // Other
  { names: ['singapore'], lat: 1.3521, lng: 103.8198 },
  { names: ['tokyo', 'japan'], lat: 35.6762, lng: 139.6503 },
  { names: ['sydney', 'australia'], lat: -33.8688, lng: 151.2093 },
  { names: ['dubai', 'uae'], lat: 25.2048, lng: 55.2708 },
  { names: ['hong kong'], lat: 22.3193, lng: 114.1694 },
  { names: ['beijing', 'china'], lat: 39.9042, lng: 116.4074 },
  { names: ['moscow', 'russia'], lat: 55.7558, lng: 37.6173 },
  { names: ['paris', 'france'], lat: 48.8566, lng: 2.3522 },
  { names: ['berlin', 'germany'], lat: 52.5200, lng: 13.4050 },
  { names: ['toronto', 'canada'], lat: 43.6532, lng: -79.3832 },
  { names: ['seoul', 'south korea'], lat: 37.5665, lng: 126.9780 },
  { names: ['bangkok', 'thailand'], lat: 13.7563, lng: 100.5018 },
  { names: ['jakarta', 'indonesia'], lat: -6.2088, lng: 106.8456 },
  { names: ['cairo', 'egypt'], lat: 30.0444, lng: 31.2357 },
  { names: ['nairobi', 'kenya'], lat: -1.2921, lng: 36.8219 },
  { names: ['lagos', 'nigeria'], lat: 6.5244, lng: 3.3792 },
  { names: ['são paulo', 'sao paulo', 'brazil'], lat: -23.5505, lng: -46.6333 },
  { names: ['mexico city', 'mexico'], lat: 19.4326, lng: -99.1332 },
  { names: ['islamabad', 'pakistan'], lat: 33.6844, lng: 73.0479 },
  { names: ['kabul', 'afghanistan'], lat: 34.5553, lng: 69.2075 },
  { names: ['kyiv', 'kiev', 'ukraine'], lat: 50.4501, lng: 30.5234 },
  { names: ['tel aviv', 'israel'], lat: 32.0853, lng: 34.7818 },
];

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extract location from alert text
 */
function extractLocationFromText(text: string): { lat: number; lng: number } | null {
  const lower = text.toLowerCase();
  
  for (const loc of KNOWN_LOCATIONS) {
    for (const name of loc.names) {
      const regex = new RegExp(`\\b${name}\\b`, 'i');
      if (regex.test(lower)) {
        return { lat: loc.lat, lng: loc.lng };
      }
    }
  }
  
  return null;
}

/**
 * Check if alert is relevant to user's location
 */
function isAlertRelevantToLocation(
  alert: any,
  userLat: number,
  userLng: number,
  cityName: string | null
): boolean {
  // If alert has coordinates, use distance-based filtering
  if (alert.location_lat && alert.location_lng) {
    const distance = getDistanceKm(userLat, userLng, alert.location_lat, alert.location_lng);
    const alertRadius = alert.location_radius || DEFAULT_RADIUS_KM;
    return distance <= alertRadius;
  }
  
  // Try to extract location from alert text
  const alertText = `${alert.title ?? ''} ${alert.description ?? ''}`;
  const extractedLoc = extractLocationFromText(alertText);
  
  if (extractedLoc) {
    const distance = getDistanceKm(userLat, userLng, extractedLoc.lat, extractedLoc.lng);
    return distance <= DEFAULT_RADIUS_KM;
  }
  
  // If user's city name is known, check if it appears in alert text
  if (cityName) {
    const lower = alertText.toLowerCase();
    if (lower.includes(cityName.toLowerCase())) {
      return true;
    }
  }
  
  // No location data - don't show (unless it's a national source)
  return false;
}

// Get alerts feed with location-based filtering
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // 1. Determine user location: prefer query params (live browser location), fall back to DB
    const { data: user } = await supabase
      .from('users')
      .select('location_lat, location_lng')
      .eq('id', req.userId)
      .single();

    const qLat = parseFloat(req.query.lat as string);
    const qLng = parseFloat(req.query.lng as string);
    const hasQueryLocation = !isNaN(qLat) && !isNaN(qLng) && qLat >= -90 && qLat <= 90 && qLng >= -180 && qLng <= 180;

    const userLat: number | null = hasQueryLocation ? qLat : (user?.location_lat ?? null);
    const userLng: number | null = hasQueryLocation ? qLng : (user?.location_lng ?? null);

    // If browser sent a fresh location and it differs from DB, persist it for future use
    if (hasQueryLocation && user && (user.location_lat !== qLat || user.location_lng !== qLng)) {
      void supabase
        .from('users')
        .update({ location_lat: qLat, location_lng: qLng })
        .eq('id', req.userId)
        .then(() => {});
    }

    // 2. Reverse geocode lat/lng → city name (for display)
    let cityName: string | null = null;
    if (userLat && userLng) {
      try {
        const geoRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${userLat}&longitude=${userLng}&localityLanguage=en`
        );
        const geo = await geoRes.json() as { city?: string; locality?: string };
        cityName = geo.city || geo.locality || null;
      } catch {
        // geocode failed — continue without city name
      }
    }

    // 3. Fetch incidents from Supabase
    const now = new Date().toISOString();
    const { data: incidents, error: dbErr } = await supabase
      .from('incidents')
      .select('*')
      .eq('verified', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .limit(100);

    if (dbErr) {
      console.error('Alerts query error:', dbErr);
      return res.status(500).json({ error: 'Failed to get alerts' });
    }

    if (!incidents) {
      return res.json({ alerts: [], city: cityName });
    }

    // 4. Filter by location and deduplicate
    const seenTitles = new Set<string>();
    const filtered = incidents.filter(inc => {
      // Deduplicate by normalized title
      const normalizedTitle = inc.title?.toLowerCase().trim();
      if (seenTitles.has(normalizedTitle)) {
        return false;
      }
      seenTitles.add(normalizedTitle);

      // Open-Meteo weather alerts are per-user - only show user's own alerts
      if (inc.source === 'Open-Meteo') {
        // external_id format: WEATHER-{userId}-{date}
        const externalId = inc.external_id || '';
        return externalId.includes(`WEATHER-${req.userId}-`);
      }

      // Always show national/official alerts (they're relevant everywhere)
      if (NATIONAL_SOURCES.includes(inc.source)) return true;

      // India news sources: show to users in India, location-filter for others
      if (INDIA_NEWS_SOURCES.includes(inc.source)) {
        if (!userLat || !userLng) return true;
        // User is in India → show all India news
        if (
          userLat >= INDIA_BOUNDS.latMin && userLat <= INDIA_BOUNDS.latMax &&
          userLng >= INDIA_BOUNDS.lngMin && userLng <= INDIA_BOUNDS.lngMax
        ) {
          return true;
        }
        // User outside India → only show if their city is mentioned in the article
        return isAlertRelevantToLocation(inc, userLat, userLng, cityName);
      }
      
      // If user has no location, show all alerts
      if (!userLat || !userLng) return true;
      
      // Check if alert is relevant to user's location
      return isAlertRelevantToLocation(inc, userLat, userLng, cityName);
    });

    // 5. Sort: severity first, then newest
    filtered.sort((a, b) => {
      const sevA = SEVERITY_ORDER[a.severity?.toLowerCase()] ?? 3;
      const sevB = SEVERITY_ORDER[b.severity?.toLowerCase()] ?? 3;
      if (sevA !== sevB) return sevA - sevB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Format response
    const alerts = filtered.map(inc => ({
      id: inc.id,
      title: inc.title,
      description: inc.description,
      category: inc.category?.toLowerCase(),
      severity: inc.severity?.toLowerCase(),
      source: inc.source,
      sourceUrl: inc.source_url,
      articleUrl: inc.article_url,
      imageUrl: inc.image_url,
      actionStep: inc.action_step,
      steps: inc.steps,
      verified: inc.verified,
      aiProcessed: inc.ai_processed,
      aiConfidence: inc.ai_confidence,
      createdAt: inc.created_at,
      expiresAt: inc.expires_at,
    }));

    res.json({ alerts, city: cityName });
  } catch (error) {
    console.error('Alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Get single alert detail
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { data: incident, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !incident) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({
      id: incident.id,
      title: incident.title,
      description: incident.description,
      category: incident.category?.toLowerCase(),
      severity: incident.severity?.toLowerCase(),
      source: incident.source,
      sourceUrl: incident.source_url,
      articleUrl: incident.article_url,
      imageUrl: incident.image_url,
      actionStep: incident.action_step,
      steps: incident.steps,
      verified: incident.verified,
      aiProcessed: incident.ai_processed,
      aiConfidence: incident.ai_confidence,
      createdAt: incident.created_at,
      expiresAt: incident.expires_at,
    });
  } catch (error) {
    console.error('Get alert error:', error);
    res.status(500).json({ error: 'Failed to get alert' });
  }
});

// Cleanup duplicate alerts (admin endpoint)
router.post('/cleanup', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    console.log('[Cleanup] Starting duplicate cleanup...');
    
    // Get all alerts ordered by creation date
    const { data: allAlerts, error: fetchError } = await supabase
      .from('incidents')
      .select('id, title, description, source, created_at, location_lat, location_lng')
      .order('created_at', { ascending: true });

    if (fetchError || !allAlerts) {
      return res.status(500).json({ error: 'Failed to fetch alerts' });
    }

    const toDelete: string[] = [];
    const seen: Array<{ id: string; title: string; description: string; source: string; location_lat: number | null; location_lng: number | null }> = [];

    for (const alert of allAlerts) {
      let isDuplicate = false;
      
      for (const existing of seen) {
        if (existing.source === alert.source) {
          // Check if alerts are similar
          if (isAlertSimilar(alert, existing)) {
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
      const { error: deleteError } = await supabase
        .from('incidents')
        .delete()
        .in('id', toDelete);

      if (deleteError) {
        console.error('[Cleanup] Error deleting duplicates:', deleteError);
        return res.status(500).json({ error: 'Failed to delete duplicates' });
      }
    }

    console.log(`[Cleanup] Removed ${toDelete.length} duplicate alerts`);
    res.json({ removed: toDelete.length, remaining: seen.length });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup alerts' });
  }
});

/**
 * Check if two alerts are similar (for cleanup)
 */
function isAlertSimilar(
  alert1: { title: string; description: string; location_lat: number | null; location_lng: number | null },
  alert2: { title: string; description: string; location_lat: number | null; location_lng: number | null }
): boolean {
  const text1 = `${alert1.title} ${alert1.description || ''}`.toLowerCase();
  const text2 = `${alert2.title} ${alert2.description || ''}`.toLowerCase();
  
  // Check for same event type
  const eventTypes = [
    'avalanche', 'flood', 'flash flood', 'winter storm', 'tornado', 
    'hurricane', 'severe thunderstorm', 'blizzard', 'ice storm',
    'heat wave', 'extreme heat', 'freeze', 'frost', 'wind', 'fire',
    'earthquake', 'tsunami', 'volcanic', 'dust storm', 'fog'
  ];
  
  let event1: string | null = null;
  let event2: string | null = null;
  
  for (const event of eventTypes) {
    if (text1.includes(event)) event1 = event;
    if (text2.includes(event)) event2 = event;
  }
  
  // Same event type + geographic proximity = duplicate
  if (event1 && event2 && event1 === event2) {
    if (alert1.location_lat && alert1.location_lng && alert2.location_lat && alert2.location_lng) {
      const distance = getDistanceKm(
        alert1.location_lat, alert1.location_lng,
        alert2.location_lat, alert2.location_lng
      );
      if (distance <= 150) return true;
    }
  }
  
  // High text similarity = duplicate
  const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));
  const intersection = [...words1].filter(w => words2.has(w));
  const union = new Set([...words1, ...words2]);
  const similarity = intersection.length / union.size;
  
  return similarity >= 0.5;
}

export default router;
