import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { supabase } from '../db/database.js';
import { verifyIncident, RawIncident } from './aiVerification.js';

/**
 * Fetches safety incidents from external sources and caches them in the database.
 * Uses NewsData.io free tier as a real API source, plus mock data as fallback.
 */

const NEWS_API_KEY = process.env.NEWS_API_KEY || '';

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract key terms for similarity comparison
 */
function extractKeyTerms(text: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
    'that', 'these', 'those', 'it', 'its', 'as', 'if', 'when', 'than'
  ]);
  
  const normalized = normalizeText(text);
  const words = normalized.split(' ').filter(w => w.length > 2 && !stopWords.has(w));
  return new Set(words);
}

/**
 * Calculate Jaccard similarity
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Generate content hash for deduplication
 */
function generateContentHash(title: string, source: string, sourceUrl?: string): string {
  if (sourceUrl) {
    return createHash('sha256')
      .update(`${source}:${sourceUrl}`)
      .digest('hex')
      .substring(0, 32);
  }
  
  const normalizedTitle = normalizeText(title);
  return createHash('sha256')
    .update(`${source}:${normalizedTitle}`)
    .digest('hex')
    .substring(0, 32);
}

// Mock incidents for when external APIs are unavailable
const mockIncidents: RawIncident[] = [
  {
    title: 'Suspicious Package Found at Transit Station',
    description: 'Authorities are investigating a suspicious package found at the downtown transit station. The area has been cordoned off and bomb disposal units are on scene. Commuters are advised to use alternate routes.',
    source: 'Local News Network',
    sourceUrl: 'https://example.com/news/suspicious-package',
    location: { lat: 40.7505, lng: -73.9934 },
  },
  {
    title: 'Flash Flood Warning Issued for Coastal Areas',
    description: 'The National Weather Service has issued a flash flood warning for coastal communities. Heavy rainfall expected over the next 12 hours. Residents in low-lying areas should prepare for possible evacuation.',
    source: 'National Weather Service',
    location: { lat: 40.6892, lng: -74.0445 },
  },
  {
    title: 'New Ransomware Variant Targeting Small Businesses',
    description: 'Cybersecurity researchers have identified a new ransomware strain specifically targeting small businesses through phishing emails disguised as invoice notifications. Update your antivirus software immediately.',
    source: 'Cyber Threat Intelligence',
    sourceUrl: 'https://example.com/cyber/ransomware-alert',
  },
  {
    title: 'Food Safety Recall: Contaminated Produce',
    description: 'The FDA has issued a recall for pre-packaged salad mixes from multiple brands due to potential Listeria contamination. Check your refrigerator and dispose of affected products.',
    source: 'FDA Safety Alerts',
    sourceUrl: 'https://example.com/fda/recall',
  },
  {
    title: 'Phone Scam Impersonating Tax Authority',
    description: 'Reports of phone scammers impersonating tax officials demanding immediate payment via gift cards. The tax authority never requests payment by phone. Hang up and report the number.',
    source: 'Consumer Protection Bureau',
  },
];

export async function fetchAndCacheIncidents(): Promise<number> {
  let rawIncidents: RawIncident[] = [];

  // Try fetching from a real news API
  if (NEWS_API_KEY) {
    try {
      const response = await fetch(
        `https://newsdata.io/api/1/news?apikey=${NEWS_API_KEY}&q=safety%20OR%20crime%20OR%20scam%20OR%20weather%20warning&language=en&size=5`
      );
      const data = await response.json() as { results?: any[] };

      if (data.results && data.results.length > 0) {
        rawIncidents = data.results.map((article: any) => ({
          title: article.title || 'Untitled',
          description: article.description || article.content || '',
          source: article.source_id || 'News API',
          sourceUrl: article.link || undefined,
        }));
      }
    } catch (error) {
      console.warn('External API fetch failed, using mock data:', error);
    }
  }

  // Fallback to mock data if no external results
  if (rawIncidents.length === 0) {
    // Pick 2-3 random mock incidents to simulate new data
    const shuffled = [...mockIncidents].sort(() => Math.random() - 0.5);
    rawIncidents = shuffled.slice(0, 3);
  }

  let inserted = 0;

  for (const raw of rawIncidents) {
    // Check 1: Content hash match
    const contentHash = generateContentHash(raw.title, raw.source, raw.sourceUrl);
    const { data: existingByHash } = await supabase
      .from('incidents')
      .select('id')
      .eq('content_hash', contentHash)
      .limit(1);

    if (existingByHash && existingByHash.length > 0) continue;

    // Check 2: Semantic similarity with recent alerts
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentAlerts } = await supabase
      .from('incidents')
      .select('id, title, description')
      .gte('created_at', weekAgo)
      .limit(50);

    let isDuplicate = false;
    if (recentAlerts && recentAlerts.length > 0) {
      const rawTerms = extractKeyTerms(raw.title + ' ' + raw.description);
      for (const existing of recentAlerts) {
        const existingTerms = extractKeyTerms(existing.title + ' ' + (existing.description || ''));
        if (jaccardSimilarity(rawTerms, existingTerms) >= 0.6) {
          isDuplicate = true;
          break;
        }
      }
    }

    if (isDuplicate) continue;

    // Run AI verification
    const verified = await verifyIncident(raw);

    const { error } = await supabase.from('incidents').insert({
      id: uuidv4(),
      title: verified.summary || raw.title,
      description: raw.description,
      category: verified.category,
      severity: verified.severity,
      location_lat: raw.location?.lat || null,
      location_lng: raw.location?.lng || null,
      location_radius: raw.location ? 10 : null,
      source: raw.source,
      source_url: raw.sourceUrl || null,
      verified: verified.verified,
      ai_confidence: verified.aiConfidence,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      content_hash: contentHash,
    });

    if (!error) inserted++;
  }

  return inserted;
}

/**
 * Start periodic fetching. Runs once on startup, then every 30 minutes.
 */
export function startPeriodicFetch() {
  // Fetch on startup (with a small delay to let the server start)
  setTimeout(async () => {
    try {
      const count = await fetchAndCacheIncidents();
      console.log(`📡 Fetched and cached ${count} new incidents`);
    } catch (err) {
      console.error('Initial fetch failed:', err);
    }
  }, 5000);

  // Then every 30 minutes
  setInterval(async () => {
    try {
      const count = await fetchAndCacheIncidents();
      if (count > 0) {
        console.log(`📡 Fetched and cached ${count} new incidents`);
      }
    } catch (err) {
      console.error('Periodic fetch failed:', err);
    }
  }, 30 * 60 * 1000);
}
