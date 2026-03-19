import { Router, Response } from 'express';
import { supabase } from '../db/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { fetchAndCacheIncidents } from '../services/dataFetcher.js';

const router = Router();

const SEVERITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

// Get feed
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { locationBased, category, severity } = req.query;

    let query = supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    // Filter by category
    if (category && typeof category === 'string' && category !== 'ALL') {
      query = query.eq('category', category.toUpperCase());
    }

    // Filter by severity
    if (severity && typeof severity === 'string' && severity !== 'ALL') {
      query = query.eq('severity', severity.toUpperCase());
    }

    if (locationBased === 'true') {
      // Get user location
      const { data: user } = await supabase
        .from('users')
        .select('location_lat, location_lng')
        .eq('id', req.userId)
        .single();

      if (user?.location_lat && user?.location_lng) {
        const latRange = 0.45; // ~50km
        const lngRange = 0.45;

        query = query.or(
          `location_lat.is.null,and(location_lat.gte.${user.location_lat - latRange},location_lat.lte.${user.location_lat + latRange},location_lng.gte.${user.location_lng - lngRange},location_lng.lte.${user.location_lng + lngRange})`
        );
      }
    }

    const { data: incidents, error } = await query;

    if (error) {
      console.error('Feed query error:', error);
      return res.status(500).json({ error: 'Failed to get feed' });
    }

    const formatted = (incidents || []).map(inc => ({
      id: inc.id,
      title: inc.title,
      description: inc.description,
      category: inc.category,
      severity: inc.severity,
      location: inc.location_lat ? {
        lat: inc.location_lat,
        lng: inc.location_lng,
        radius: inc.location_radius
      } : null,
      source: inc.source,
      sourceUrl: inc.source_url,
      verified: inc.verified,
      aiConfidence: inc.ai_confidence,
      createdAt: inc.created_at
    }));

    // Sort by severity HIGH → MEDIUM → LOW, then by createdAt desc within same severity
    formatted.sort((a, b) => {
      const sevDiff = (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3);
      if (sevDiff !== 0) return sevDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.json(formatted);
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ error: 'Failed to get feed' });
  }
});

// Get incident details
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { data: incident, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    res.json({
      id: incident.id,
      title: incident.title,
      description: incident.description,
      category: incident.category,
      severity: incident.severity,
      location: incident.location_lat ? {
        lat: incident.location_lat,
        lng: incident.location_lng,
        radius: incident.location_radius
      } : null,
      source: incident.source,
      sourceUrl: incident.source_url,
      verified: incident.verified,
      aiConfidence: incident.ai_confidence,
      createdAt: incident.created_at
    });
  } catch (error) {
    console.error('Get incident error:', error);
    res.status(500).json({ error: 'Failed to get incident' });
  }
});

// Refresh feed — trigger manual data fetch
router.post('/refresh', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const count = await fetchAndCacheIncidents();
    res.json({ success: true, newIncidents: count });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh feed' });
  }
});

export default router;
