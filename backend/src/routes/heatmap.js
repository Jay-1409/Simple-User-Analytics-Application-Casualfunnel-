import express from 'express';
import { Event } from '../models/Event.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errors.js';

const router = express.Router();

router.get(
  '/heatmap',
  asyncHandler(async (req, res) => {
    const pageUrl = String(req.query.page_url || '').trim();
    if (!pageUrl) {
      throw new AppError('page_url query parameter is required', 400, 'VALIDATION_ERROR');
    }

    const clicks = await Event.find({ page_url: pageUrl, event_type: 'click' })
      .sort({ timestamp: 1 })
      .select('-_id x y viewport_width viewport_height timestamp')
      .lean();

    res.json({ data: clicks });
  })
);

router.get(
  '/pages',
  asyncHandler(async (_req, res) => {
    const pages = await Event.distinct('page_url');
    res.json({ data: pages.sort() });
  })
);

export { router as heatmapRouter };
