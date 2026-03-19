/**
 * Normalize - Upsert helper for incidents
 * Handles deduplication and normalization of alert data
 */
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { supabase } from './supabaseClient.js';

export interface NormalizedAlert {
  id?: string;
  title: string;
  description: string;
  category: 'CRIME' | 'WEATHER' | 'HEALTH' | 'SCAM' | 'CYBER' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  source: string;
  sourceUrl?: string;
  locationLat?: number;
  locationLng?: number;
  locationRadius?: number;
  verified: boolean;
  aiConfidence?: number;
  aiSummary?: string;
  expiresAt?: string;
}

/**
 * Normalize text for comparison - removes noise words, punctuation, extra spaces
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .replace(/\s+/g, ' ')       // Collapse whitespace
    .trim();
}

/**
 * Extract key terms from text for similarity comparison
 */
function extractKeyTerms(text: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
    'that', 'these', 'those', 'it', 'its', 'as', 'if', 'when', 'than',
    'so', 'no', 'not', 'only', 'same', 'such', 'very', 'just', 'also',
    'now', 'here', 'there', 'where', 'who', 'what', 'which', 'how', 'all',
    'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'any',
    'new', 'old', 'first', 'last', 'long', 'great', 'little', 'own', 'still'
  ]);
  
  const normalized = normalizeText(text);
  const words = normalized.split(' ').filter(w => w.length > 2 && !stopWords.has(w));
  return new Set(words);
}

/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Extract event type from alert text (for weather/emergency alerts)
 */
function extractEventType(text: string): string | null {
  const lower = text.toLowerCase();
  const eventTypes = [
    'avalanche', 'flood', 'flash flood', 'winter storm', 'tornado', 
    'hurricane', 'severe thunderstorm', 'blizzard', 'ice storm',
    'heat wave', 'extreme heat', 'freeze', 'frost', 'wind', 'fire',
    'earthquake', 'tsunami', 'volcanic', 'dust storm', 'fog'
  ];
  
  for (const event of eventTypes) {
    if (lower.includes(event)) {
      return event;
    }
  }
  return null;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
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
 * Check if two alerts are semantically similar
 * Uses multiple signals: event type, geographic proximity, and text similarity
 */
function areAlertsSimilar(
  alert1: { title: string; description: string; locationLat?: number | null; locationLng?: number | null },
  alert2: { title: string; description?: string | null; location_lat?: number | null; location_lng?: number | null }
): boolean {
  const text1 = `${alert1.title} ${alert1.description || ''}`;
  const text2 = `${alert2.title} ${alert2.description || ''}`;
  
  // Check 1: Same event type (strong signal for weather alerts)
  const event1 = extractEventType(text1);
  const event2 = extractEventType(text2);
  
  if (event1 && event2 && event1 === event2) {
    // Same event type - check geographic proximity
    const lat1 = alert1.locationLat;
    const lng1 = alert1.locationLng;
    const lat2 = alert2.location_lat;
    const lng2 = alert2.location_lng;
    
    if (lat1 && lng1 && lat2 && lng2) {
      const distance = getDistanceKm(lat1, lng1, lat2, lng2);
      // Same event type within 150km = likely duplicate
      if (distance <= 150) {
        return true;
      }
    }
  }
  
  // Check 2: High text similarity (for non-weather alerts or when location not available)
  const terms1 = extractKeyTerms(text1);
  const terms2 = extractKeyTerms(text2);
  const similarity = jaccardSimilarity(terms1, terms2);
  
  // 50% text similarity = likely duplicate
  if (similarity >= 0.5) {
    return true;
  }
  
  // Check 3: Title similarity (titles are usually more distinctive)
  const titleTerms1 = extractKeyTerms(alert1.title);
  const titleTerms2 = extractKeyTerms(alert2.title);
  const titleSimilarity = jaccardSimilarity(titleTerms1, titleTerms2);
  
  // 60% title similarity = likely duplicate
  if (titleSimilarity >= 0.6) {
    return true;
  }
  
  return false;
}

/**
 * Generate a content hash for deduplication
 * Uses source + sourceUrl (if available) or source + normalized title
 */
function generateContentHash(alert: NormalizedAlert): string {
  // If we have a sourceUrl, use it as the primary identifier (most reliable)
  if (alert.sourceUrl) {
    return createHash('sha256')
      .update(`${alert.source}:${alert.sourceUrl}`)
      .digest('hex')
      .substring(0, 32);
  }
  
  // Otherwise hash source + normalized title (more robust than including description)
  const normalizedTitle = normalizeText(alert.title);
  return createHash('sha256')
    .update(`${alert.source}:${normalizedTitle}`)
    .digest('hex')
    .substring(0, 32);
}

/**
 * Check if an alert is semantically similar to existing alerts
 * Returns the ID of a similar alert if found, null otherwise
 */
async function findSimilarAlert(alert: NormalizedAlert): Promise<string | null> {
  // Get recent alerts from the same source (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentAlerts } = await supabase
    .from('incidents')
    .select('id, title, description, location_lat, location_lng')
    .eq('source', alert.source)
    .gte('created_at', weekAgo)
    .limit(50);

  if (!recentAlerts || recentAlerts.length === 0) return null;

  for (const existing of recentAlerts) {
    if (areAlertsSimilar(
      { title: alert.title, description: alert.description, locationLat: alert.locationLat, locationLng: alert.locationLng },
      existing
    )) {
      console.log(`[Dedup] Found similar alert: "${alert.title.substring(0, 50)}..." matches "${existing.title.substring(0, 50)}..."`);
      return existing.id;
    }
  }

  return null;
}

/**
 * Upsert an alert - insert if new, skip if duplicate
 * Uses content hash AND semantic similarity for reliable deduplication
 */
export async function upsertAlert(alert: NormalizedAlert): Promise<{ inserted: boolean; id: string }> {
  const contentHash = generateContentHash(alert);
  
  // Check 1: Exact content hash match
  const { data: existing } = await supabase
    .from('incidents')
    .select('id')
    .eq('content_hash', contentHash)
    .limit(1);

  if (existing && existing.length > 0) {
    return { inserted: false, id: existing[0].id };
  }

  // Check 2: Semantic similarity check (catches rephrased duplicates)
  const similarId = await findSimilarAlert(alert);
  if (similarId) {
    return { inserted: false, id: similarId };
  }

  const id = alert.id || uuidv4();
  const expiresAt = alert.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('incidents').insert({
    id,
    title: alert.title,
    description: alert.description,
    category: alert.category,
    severity: alert.severity,
    source: alert.source,
    source_url: alert.sourceUrl || null,
    location_lat: alert.locationLat || null,
    location_lng: alert.locationLng || null,
    location_radius: alert.locationRadius || null,
    verified: alert.verified,
    ai_confidence: alert.aiConfidence || null,
    expires_at: expiresAt,
    content_hash: contentHash,
  });

  if (error) {
    console.error('Upsert error:', error);
    throw error;
  }

  return { inserted: true, id };
}

/**
 * Batch upsert multiple alerts
 */
export async function batchUpsertAlerts(alerts: NormalizedAlert[]): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const alert of alerts) {
    const result = await upsertAlert(alert);
    if (result.inserted) {
      inserted++;
    } else {
      skipped++;
    }
  }

  return { inserted, skipped };
}

export { normalizeText, extractKeyTerms, jaccardSimilarity, findSimilarAlert, areAlertsSimilar, extractEventType, getDistanceKm };
