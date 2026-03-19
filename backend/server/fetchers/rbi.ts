/**
 * RBI (Reserve Bank of India) Fetcher
 * Fetches alerts from RBI RSS feed (no API key required)
 * https://www.rbi.org.in/scripts/rss.aspx
 */
import { parseStringPromise } from 'xml2js';

const RBI_RSS_URL = 'https://www.rbi.org.in/scripts/rss.aspx';

interface RSSItem {
  title: string[];
  description: string[];
  link: string[];
  pubDate: string[];
}

interface RSSChannel {
  item?: RSSItem[];
}

interface RSSFeed {
  rss?: {
    channel?: RSSChannel[];
  };
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
 * Strip HTML tags from a string
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

/**
 * Fetch alerts from RBI RSS feed
 * Returns first 10 items
 */
export async function fetchRBIAlerts(): Promise<FetchedAlert[]> {
  try {
    const response = await fetch(RBI_RSS_URL, {
      headers: {
        'User-Agent': 'CommunityGuardian/1.0',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      console.error('[RBI] API error:', response.status, response.statusText);
      return [];
    }

    const xmlText = await response.text();
    
    // Use lenient parsing options to handle malformed XML
    const parsed: RSSFeed = await parseStringPromise(xmlText, {
      strict: false,
      normalize: true,
      normalizeTags: true,
    });

    const expires_at = new Date(Date.now() + 86400000).toISOString();

    const items = parsed.rss?.channel?.[0]?.item;
    if (!items || !Array.isArray(items)) {
      return [];
    }
    console.log("items -------> ",items)

    return items.slice(0, 10).map((item) => {
      const link = item.link?.[0] || '';
      const externalId = `RBI-${Buffer.from(link).toString('base64').slice(0, 20)}`;
      const title = item.title?.[0] || 'RBI Alert';
      const description = stripHtml(item.description?.[0] || '');

      return {
        external_id: externalId,
        title,
        description,
        category: 'news',
        severity: 'low',
        source: 'RBI',
        source_url: link,
        verified: true,
        ai_processed: false,
        expires_at,
      };
    });
  } catch (error) {
    console.error('[RBI] Fetch error:', error);
    return [];
  }
}

export default fetchRBIAlerts;
