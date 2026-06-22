import express from 'express';
import { Event } from '../models/Event.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errors.js';
import { buildTimestampMatch } from '../utils/dateRange.js';

const router = express.Router();

router.get(
  '/heatmap',
  asyncHandler(async (req, res) => {
    const pageUrl = String(req.query.page_url || '').trim();
    if (!pageUrl) {
      throw new AppError('page_url query parameter is required', 400, 'VALIDATION_ERROR');
    }

    const timestampMatch = buildTimestampMatch(req.query);
    const clicks = await Event.find({ page_url: pageUrl, event_type: 'click', ...timestampMatch })
      .sort({ timestamp: 1 })
      .select('-_id x y viewport_width viewport_height timestamp')
      .lean();

    res.json({ data: clicks });
  })
);

router.get(
  '/pages',
  asyncHandler(async (req, res) => {
    const timestampMatch = buildTimestampMatch(req.query);
    const eventType = String(req.query.event_type || '').trim();
    const allowedTypes = ['page_view', 'click'];
    if (eventType && !allowedTypes.includes(eventType)) {
      throw new AppError('event_type must be page_view or click', 400, 'VALIDATION_ERROR');
    }

    const pages = await Event.distinct('page_url', {
      ...timestampMatch,
      ...(eventType ? { event_type: eventType } : {})
    });
    res.json({ data: pages.sort() });
  })
);

export { router as heatmapRouter };
