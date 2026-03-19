import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

const PHISHTANK_API_URL = 'http://data.phishtank.com/data/online-valid.json';

interface PhishTankEntry {
  phish_id: string;
  url: string;
  phish_detail_url: string;
  target: string;
  submission_time: string;
  verified: string;
  verification_time: string;
  online: string;
}

// Cache to avoid hitting PhishTank API too frequently
let cachedData: PhishTankEntry[] = [];
let lastFetch = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

async function fetchPhishTankData(): Promise<PhishTankEntry[]> {
  const now = Date.now();
  if (cachedData.length > 0 && now - lastFetch < CACHE_TTL) {
    return cachedData;
  }

  try {
    const response = await fetch(PHISHTANK_API_URL, {
      headers: {
        'User-Agent': 'CommunityGuardian/1.0',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[PhishTank] API error:', response.status);
      return cachedData;
    }

    const data = await response.json() as PhishTankEntry[];
    if (Array.isArray(data)) {
      cachedData = data.filter(entry => entry.verified === 'yes');
      lastFetch = now;
    }
    return cachedData;
  } catch (error) {
    console.error('[PhishTank] Fetch error:', error);
    return cachedData;
  }
}

// Get phishing sites with pagination and search
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const search = (req.query.search as string || '').toLowerCase().trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const allData = await fetchPhishTankData();

    // Filter by search term
    let filtered = allData;
    if (search) {
      filtered = allData.filter(entry =>
        entry.url.toLowerCase().includes(search) ||
        entry.target.toLowerCase().includes(search)
      );
    }

    // Paginate
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const items = filtered.slice(offset, offset + limit);

    // Format response
    const phishingSites = items.map(entry => ({
      id: entry.phish_id,
      url: entry.url,
      target: entry.target,
      detailUrl: entry.phish_detail_url || `https://www.phishtank.com/phish_detail.php?phish_id=${entry.phish_id}`,
      submittedAt: entry.submission_time,
      verifiedAt: entry.verification_time,
      online: entry.online === 'yes',
    }));

    res.json({
      sites: phishingSites,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Phishing route error:', error);
    res.status(500).json({ error: 'Failed to fetch phishing data' });
  }
});

export default router;
