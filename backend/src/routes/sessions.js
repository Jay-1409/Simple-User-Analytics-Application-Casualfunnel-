import express from 'express';
import { Event } from '../models/Event.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errors.js';

const router = express.Router();

const parsePositiveInt = (value, fallback, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1, 10_000);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const skip = (page - 1) * limit;

    const [result] = await Event.aggregate([
      {
        $group: {
          _id: '$session_id',
          event_count: { $sum: 1 },
          first_seen: { $min: '$timestamp' },
          last_seen: { $max: '$timestamp' },
          pages: { $addToSet: '$page_url' }
        }
      },
      {
        $project: {
          _id: 0,
          session_id: '$_id',
          event_count: 1,
          first_seen: 1,
          last_seen: 1,
          pages_visited: { $size: '$pages' }
        }
      },
      { $sort: { last_seen: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          meta: [{ $count: 'total' }]
        }
      }
    ]);

    const total = result?.meta?.[0]?.total || 0;

    res.json({
      data: result?.data || [],
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });
  })
);

router.get(
  '/:sessionId/events',
  asyncHandler(async (req, res) => {
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId) {
      throw new AppError('sessionId is required', 400, 'VALIDATION_ERROR');
    }

    const events = await Event.find({ session_id: sessionId })
      .sort({ timestamp: 1 })
      .select('-_id session_id event_type page_url timestamp client_timestamp x y viewport_width viewport_height user_agent')
      .lean();

    if (events.length === 0) {
      throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    res.json({ data: events });
  })
);

export { router as sessionsRouter };
