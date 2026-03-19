/**
 * RSS News Fetcher - Fetches safety-relevant news from multiple RSS feeds
 * Parses RSS XML and returns normalized incident objects for AI filtering
 */
import { parseStringPromise } from 'xml2js';

const RSS_FEEDS = [
  // India safety and crime news
  { url: 'https://feeds.feedburner.com/ndtvnews-india-news', source: 'NDTV', country: 'India' },
  { url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms', source: 'Times of India', country: 'India' },
  { url: 'https://www.thehindu.com/news/national/feeder/default.rss', source: 'The Hindu', country: 'India' },
  { url: 'https://indianexpress.com/feed/', source: 'Indian Express', country: 'India' },
  { url: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml', source: 'Hindustan Times', country: 'India' },
  // Cybersecurity news (global)
  { url: 'https://feeds.feedburner.com/TheHackersNews', source: 'The Hacker News', country: 'Global' },
  { url: 'https://www.bleepingcomputer.com/feed/', source: 'BleepingComputer', country: 'Global' },
  { url: 'https://krebsonsecurity.com/feed/', source: 'Krebs on Security', country: 'Global' },
  // BBC and Reuters for international safety news
  { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC News', country: 'Global' },
  { url: 'https://feeds.reuters.com/reuters/topNews', source: 'Reuters', country: 'Global' },
];

export interface RSSArticle {
  external_id: string;
  title: string;
  description: string;
  article_url: string;
  image_url: string | null;
  source: string;
  source_url: string;
  category: string;
  severity: string;
  verified: boolean;
  ai_processed: boolean;
  expires_at: string;
  created_at: string;
}

/**
 * Fetch and parse all RSS feeds
 * Uses sequential fetching with delays to avoid rate limiting
 */
export async function fetchRSSNews(): Promise<RSSArticle[]> {
  const allArticles: RSSArticle[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: {
          'User-Agent': 'CommunityGuardian/1.0 (safety news aggregator)',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(`[RSS] Failed ${feed.source}: HTTP ${res.status}`);
        continue;
      }

      const xml = await res.text();
      const data = await parseStringPromise(xml, { explicitArray: true });
      const items = data?.rss?.channel?.[0]?.item ?? [];

      // Take only the 5 most recent articles per feed
      const recent = items.slice(0, 5);

      for (const item of recent) {
        const title = item.title?.[0]?.trim?.() ?? (typeof item.title?.[0] === 'object' ? item.title?.[0]?._ : '') ?? '';
        const rawDescription = item.description?.[0]?.trim?.() ?? (typeof item.description?.[0] === 'object' ? item.description?.[0]?._ : '') ?? '';
        const link = item.link?.[0]?.trim?.() ?? (typeof item.link?.[0] === 'object' ? item.link?.[0]?._ : '') ?? '';
        const pubDate = item.pubDate?.[0]?.trim?.() ?? '';

        // Skip if title or link is missing
        if (!title || !link) continue;

        // Strip all HTML tags from description
        const cleanDesc = rawDescription
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'")
          .trim()
          .slice(0, 500);

        // Try to extract image from media:content or enclosure
        const imageUrl =
          item['media:content']?.[0]?.['$']?.url ??
          item['media:thumbnail']?.[0]?.['$']?.url ??
          item.enclosure?.[0]?.['$']?.url ??
          null;

        // Generate stable external_id from the article URL
        const external_id = 'RSS-' + Buffer.from(link).toString('base64').slice(0, 24);

        allArticles.push({
          external_id,
          title,
          description: cleanDesc,
          article_url: link,
          image_url: imageUrl,
          source: feed.source,
          source_url: link,
          category: 'news',
          severity: 'low',
          verified: false,
          ai_processed: false,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          created_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        });
      }

      // 300ms delay between feeds to be respectful
      await new Promise((r) => setTimeout(r, 300));
    } catch (err: any) {
      // One feed failing must never stop the others
      console.warn(`[RSS] Error fetching ${feed.source}:`, err.message);
      continue;
    }
  }

  console.log(`[RSS] Fetched ${allArticles.length} articles total`);
  return allArticles;
}

export default fetchRSSNews;
