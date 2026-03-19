/**
 * PhishTank Fetcher
 * Fetches verified phishing URLs from PhishTank (no API key required)
 * https://www.phishtank.com/developer_info.php
 */

const PHISHTANK_API_URL = 'http://data.phishtank.com/data/online-valid.json';

// Cache configuration
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second base delay for exponential backoff

// In-memory cache variables
let cachedAlerts: FetchedAlert[] = [];
let lastFetchTime = 0;

interface PhishTankEntry {
  phish_id: string;
  url: string;
  target: string;
  submission_time: string;
  verified: string;
}

export interface FetchedAlert {
  external_id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  source: string;
  source_url: string;
  verified: boolean;
  ai_processed: boolean;
  expires_at: string;
}

/**
 * Helper function to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch verified phishing URLs from PhishTank
 * Only includes items where verified === "yes"
 * Returns first 20 items
 * 
 * Implements caching with TTL and exponential backoff retry for rate limits
 */
export async function fetchPhishTank(): Promise<FetchedAlert[]> {
  // Check if valid cached data exists
  const now = Date.now();
  if (cachedAlerts.length > 0 && now - lastFetchTime < CACHE_TTL) {
    return cachedAlerts;
  }

  // Attempt to fetch with retry logic for rate limits
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(PHISHTANK_API_URL, {
        headers: {
          'User-Agent': 'CommunityGuardian/1.0',
          Accept: 'application/json',
        },
      });

      // Handle rate limit (HTTP 429) with exponential backoff
      if (response.status === 429) {
        console.warn(`[PhishTank] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
        
        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s
          const backoffDelay = BASE_DELAY * Math.pow(2, attempt);
          await delay(backoffDelay);
          continue;
        }
        
        // Retries exhausted, return cached data if available
        console.warn('[PhishTank] Rate limit retries exhausted, using cached data');
        return cachedAlerts;
      }

      if (!response.ok) {
        console.error('[PhishTank] API error:', response.status, response.statusText);
        // Return cached data on errors when available
        return cachedAlerts.length > 0 ? cachedAlerts : [];
      }

      const data = await response.json() as PhishTankEntry[];
      const expires_at = new Date(Date.now() + 86400000).toISOString();

      if (!Array.isArray(data)) {
        // Return cached data on invalid response when available
        return cachedAlerts.length > 0 ? cachedAlerts : [];
      }

      const processedAlerts = data
        .filter((entry) => entry.verified === 'yes')
        .slice(0, 20)
        .map((entry) => ({
          external_id: `PHISH-${entry.phish_id}`,
          title: `Phishing site impersonating ${entry.target}`,
          description: `A verified phishing URL targeting ${entry.target} users has been reported.`,
          category: 'news',
          severity: 'low',
          source: 'PhishTank',
          source_url: `https://www.phishtank.com/phish_detail.php?phish_id=${entry.phish_id}`,
          verified: true,
          ai_processed: false,
          expires_at,
        }));

      // Update cache on successful fetch
      cachedAlerts = processedAlerts;
      lastFetchTime = Date.now();

      return processedAlerts;
    } catch (error) {
      console.error('[PhishTank] Fetch error:', error);
      // Return cached data on errors when available
      return cachedAlerts.length > 0 ? cachedAlerts : [];
    }
  }

  // Should not reach here, but return cached data as fallback
  return cachedAlerts;
}

/**
 * Reset the cache (for testing purposes)
 */
export function resetCache(): void {
  cachedAlerts = [];
  lastFetchTime = 0;
}

/**
 * Get cache state (for testing purposes)
 */
export function getCacheState(): { cachedAlerts: FetchedAlert[]; lastFetchTime: number } {
  return { cachedAlerts, lastFetchTime };
}

export default fetchPhishTank;

// Export cache constants for testing
export { CACHE_TTL, MAX_RETRIES, BASE_DELAY };
