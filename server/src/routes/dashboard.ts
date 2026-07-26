import { Router, Request, Response } from 'express';
import { dashboardService } from '../services/dashboardService';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  const stats = dashboardService.getStats();
  res.json({ success: true, data: stats });
}));

// GET /api/dashboard/recent-activity
router.get('/recent-activity', asyncHandler(async (_req: Request, res: Response) => {
  const activity = dashboardService.getRecentActivity();
  res.json({ success: true, data: activity });
}));

export default router;