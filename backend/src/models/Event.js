import mongoose from 'mongoose';

const EVENT_TYPES = ['page_view', 'click'];

const eventSchema = new mongoose.Schema(
  {
    session_id: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      maxlength: 128
    },
    event_type: {
      type: String,
      required: true,
      enum: EVENT_TYPES
    },
    page_url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    },
    client_timestamp: {
      type: Date,
      required: true
    },
    x: {
      type: Number,
      min: 0
    },
    y: {
      type: Number,
      min: 0
    },
    viewport_width: {
      type: Number,
      min: 1
    },
    viewport_height: {
      type: Number,
      min: 1
    },
    user_agent: {
      type: String,
      required: true,
      trim: true,
      maxlength: 512
    }
  },
  {
    versionKey: false
  }
);

eventSchema.pre('validate', function validateClickShape(next) {
  if (this.event_type === 'click') {
    if (
      !Number.isFinite(this.x) ||
      !Number.isFinite(this.y) ||
      !Number.isFinite(this.viewport_width) ||
      !Number.isFinite(this.viewport_height)
    ) {
      return next(new Error('click events require x, y, viewport_width, and viewport_height'));
    }
  }

  if (this.event_type === 'page_view') {
    this.x = undefined;
    this.y = undefined;
    this.viewport_width = undefined;
    this.viewport_height = undefined;
  }

  next();
});

// Ordered session journeys query by session_id, then sort by canonical server timestamp.
eventSchema.index({ session_id: 1, timestamp: 1 });

// Heatmap reads filter by page_url and click event_type; keep this narrow instead of indexing every field.
eventSchema.index({ page_url: 1, event_type: 1 });

export const Event = mongoose.model('Event', eventSchema);
export { EVENT_TYPES };
 