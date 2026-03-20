import { Router } from 'express';
import { healthMonitor } from '../../server/healthMonitor.js';

const router = Router();

/**
 * GET /api/health/ai
 * Returns AI service availability status and current processing mode.
 * Requirements: 1.4
 */
router.get('/ai', (_req, res) => {
  const status = healthMonitor.getStatus();
  res.json({
    available: status.available,
    lastCheck: status.lastCheck.toISOString(),
    mode: status.available ? 'ai' : 'fallback',
  });
});

export default router;
