import express from 'express';
import rateLimit from 'express-rate-limit';
import { Event, EVENT_TYPES } from '../models/Event.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errors.js';
import { env } from '../config/env.js';

const router = express.Router();
const MAX_BATCH_SIZE = 50;

const ingestionLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.[0]?.session_id || req.ip,
  message: {
    error: {
      message: 'Too many ingestion requests',
      code: 'RATE_LIMITED'
    }
  }
});

const isValidUrl = (value) => {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const parseClientTimestamp = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const validatePayloadEvent = (event, index) => {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new AppError(`Event at index ${index} must be an object`, 400, 'VALIDATION_ERROR');
  }

  if (typeof event.session_id !== 'string' || event.session_id.trim().length < 8 || event.session_id.length > 128) {
    throw new AppError(`Event at index ${index} has an invalid session_id`, 400, 'VALIDATION_ERROR');
  }

  if (!EVENT_TYPES.includes(event.event_type)) {
    throw new AppError(`Event at index ${index} has an invalid event_type`, 400, 'VALIDATION_ERROR');
  }

  if (!isValidUrl(event.page_url)) {
    throw new AppError(`Event at index ${index} has an invalid page_url`, 400, 'VALIDATION_ERROR');
  }

  const clientTimestamp = parseClientTimestamp(event.client_timestamp);
  if (!clientTimestamp) {
    throw new AppError(`Event at index ${index} has an invalid client_timestamp`, 400, 'VALIDATION_ERROR');
  }

  const base = {
    session_id: event.session_id.trim(),
    event_type: event.event_type,
    page_url: event.page_url,
    timestamp: new Date(),
    client_timestamp: clientTimestamp,
    user_agent: ''
  };

  if (event.event_type === 'click') {
    const x = Number(event.x);
    const y = Number(event.y);
    const viewportWidth = Number(event.viewport_width);
    const viewportHeight = Number(event.viewport_height);

    if (![x, y, viewportWidth, viewportHeight].every(Number.isFinite) || x < 0 || y < 0 || viewportWidth < 1 || viewportHeight < 1) {
      throw new AppError(`Event at index ${index} has invalid click coordinates or viewport dimensions`, 400, 'VALIDATION_ERROR');
    }

    return {
      ...base,
      x,
      y,
      viewport_width: viewportWidth,
      viewport_height: viewportHeight
    };
  }

  return base;
};

router.post(
  '/',
  ingestionLimiter,
  asyncHandler(async (req, res) => {
    if (!Array.isArray(req.body)) {
      throw new AppError('Request body must be an array of events', 400, 'VALIDATION_ERROR');
    }

    if (req.body.length === 0) {
      throw new AppError('Event batch cannot be empty', 400, 'VALIDATION_ERROR');
    }

    if (req.body.length > MAX_BATCH_SIZE) {
      throw new AppError(`Event batch cannot exceed ${MAX_BATCH_SIZE} events`, 400, 'VALIDATION_ERROR');
    }

    const userAgent = String(req.get('user-agent') || 'unknown').slice(0, 512);
    const documents = req.body.map((event, index) => ({
      ...validatePayloadEvent(event, index),
      user_agent: userAgent
    }));

    const inserted = await Event.insertMany(documents, { ordered: true, runValidators: true });

    res.status(202).json({
      accepted: inserted.length
    });
  })
);

export { router as eventsRouter };
