import express from 'express';
import { Event } from '../models/Event.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errors.js';

const router = express.Router();
const MIN_STEPS = 2;
const MAX_STEPS = 4;

const validateSteps = (steps) => {
  if (!Array.isArray(steps)) {
    throw new AppError('steps must be an array', 400, 'VALIDATION_ERROR');
  }

  if (steps.length < MIN_STEPS || steps.length > MAX_STEPS) {
    throw new AppError(`steps must contain ${MIN_STEPS}-${MAX_STEPS} page URLs`, 400, 'VALIDATION_ERROR');
  }

  const cleaned = steps.map((step) => (typeof step === 'string' ? step.trim() : ''));
  if (cleaned.some((step) => step.length === 0 || step.length > 2048)) {
    throw new AppError('each funnel step must be a non-empty page URL', 400, 'VALIDATION_ERROR');
  }

  return cleaned;
};

const sessionReachedStep = (events, steps) => {
  let cursor = { timestamp: new Date(0), client_timestamp: new Date(0) };
  let reached = 0;

  for (const step of steps) {
    const match = events.find((event) => {
      if (event.page_url !== step) return false;
      if (event.timestamp > cursor.timestamp) return true;
      return (
        event.timestamp.getTime() === cursor.timestamp.getTime() &&
        event.client_timestamp > cursor.client_timestamp
      );
    });
    if (!match) break;
    cursor = {
      timestamp: match.timestamp,
      client_timestamp: match.client_timestamp
    };
    reached += 1;
  }

  return reached;
};

router.post(
  '/analyze',
  asyncHandler(async (req, res) => {
    const steps = validateSteps(req.body?.steps);

    const sessions = await Event.aggregate([
      {
        $match: {
          event_type: 'page_view',
          page_url: { $in: steps }
        }
      },
      { $sort: { session_id: 1, timestamp: 1, client_timestamp: 1 } },
      {
        $group: {
          _id: '$session_id',
          events: {
            $push: {
              page_url: '$page_url',
              timestamp: '$timestamp',
              client_timestamp: '$client_timestamp'
            }
          }
        }
      }
    ]);

    const counts = steps.map(() => 0);

    for (const session of sessions) {
      const reached = sessionReachedStep(session.events, steps);
      for (let index = 0; index < reached; index += 1) {
        counts[index] += 1;
      }
    }

    const firstStepCount = counts[0] || 0;
    const data = steps.map((step, index) => {
      const previous = index === 0 ? null : counts[index - 1];
      const sessionsReached = counts[index];
      const conversionRate = firstStepCount ? (sessionsReached / firstStepCount) * 100 : 0;
      const dropoffFromPrevious =
        previous === null || previous === 0 ? null : ((previous - sessionsReached) / previous) * 100;

      return {
        step,
        stepIndex: index + 1,
        sessionsReached,
        conversionRate,
        dropoffFromPrevious
      };
    });

    res.json({ data });
  })
);

export { router as funnelsRouter };
