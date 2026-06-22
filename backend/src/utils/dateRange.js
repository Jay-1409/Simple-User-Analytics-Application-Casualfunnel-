import { AppError } from '../middleware/errors.js';

const parseDate = (value, name) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${name} must be a valid date`, 400, 'VALIDATION_ERROR');
  }
  return date;
};

export const buildTimestampMatch = (query) => {
  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');

  if (from && to && from > to) {
    throw new AppError('from must be before to', 400, 'VALIDATION_ERROR');
  }

  if (!from && !to) return {};

  return {
    timestamp: {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {})
    }
  };
};
