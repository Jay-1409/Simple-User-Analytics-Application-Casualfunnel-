import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { eventsRouter } from './routes/events.js';
import { sessionsRouter } from './routes/sessions.js';
import { heatmapRouter } from './routes/heatmap.js';
import { funnelsRouter } from './routes/funnels.js';
import { errorHandler, notFound, AppError } from './middleware/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(morgan('combined'));
app.use(express.json({ limit: '128kb', type: ['application/json', 'text/plain'] }));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new AppError('Origin is not allowed by CORS policy', 403, 'CORS_DENIED'));
    }
  })
);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/events', eventsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/funnels', funnelsRouter);
app.use('/api', heatmapRouter);

app.use(notFound);
app.use(errorHandler);

export { app };
