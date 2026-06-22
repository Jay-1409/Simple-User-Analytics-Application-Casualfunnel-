# Casualfunnel User Analytics

Lightweight session analytics with a standalone Express ingestion API, append-only MongoDB events, a dependency-free browser tracker, and a Next.js dashboard.

## Tech Stack

- Backend: Node.js, Express, Mongoose. Express stays as the standalone API so ingestion can scale and deploy independently from the dashboard.
- Database: MongoDB. Events are written as one document per event; sessions are derived by aggregation instead of maintained as a second write path.
- Tracker: vanilla JavaScript in `backend/public/tracker.js`, loadable by a plain `<script>` tag.
- Dashboard: Next.js App Router. Session and heatmap pages are client components because they read live API data at runtime.
- Local runtime: Docker Compose with separate MongoDB, backend, and frontend services.
- Deployment target: backend on Render, frontend on Vercel, database on MongoDB Atlas.

## Architecture

The browser SDK generates or refreshes a session id, queues `page_view` and `click` events, records page views on hash/history URL changes, and flushes batches every 5 seconds, at 10 queued events, or during unload with `navigator.sendBeacon`. The API validates the full batch, stamps the authoritative server `timestamp`, stores the browser's `client_timestamp` separately, and inserts with `insertMany`. MongoDB remains an append-only event log; sessions are computed with `$group` over `session_id`, and heatmaps query click events by page URL.

## Setup With Docker

```bash
docker-compose up --build
```

Services:

- Dashboard: `http://localhost:3000`
- Backend API: `http://localhost:4000`
- Demo page: `http://localhost:4000/demo.html`
- Tracker script: `http://localhost:4000/tracker.js`

Open the demo page, click around, then view sessions and heatmaps in the dashboard.

## Manual Setup

Backend:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Frontend:

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Required backend variables:

- `PORT`: API port, default `4000`.
- `MONGO_URI`: MongoDB connection string. Use Atlas in production.
- `ALLOWED_ORIGINS`: comma-separated CORS allowlist, for example `http://localhost:3000,http://127.0.0.1:3000,https://your-app.vercel.app`.
- `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`: ingestion rate limit controls.

Required frontend variable:

- `NEXT_PUBLIC_API_URL`: public API base URL. The `NEXT_PUBLIC_` prefix is required because dashboard fetches run in the browser bundle; unprefixed variables are server-only in Next.js.

## API

### `POST /api/events`

Accepts a batch of 1-50 events. The server rejects the full batch if any entry is invalid.

Request:

```json
[
  {
    "session_id": "0f2a7f90-7f30-48d8-a4fd-1685f681ef91",
    "event_type": "click",
    "page_url": "http://localhost:4000/demo.html",
    "client_timestamp": "2026-06-22T05:10:00.000Z",
    "x": 320,
    "y": 480,
    "viewport_width": 1440,
    "viewport_height": 900
  }
]
```

Response:

```json
{ "accepted": 1 }
```

### `GET /api/sessions?page=1&limit=20&from=2026-06-22T00:00:00.000Z&to=2026-06-22T23:59:59.999Z`

Returns paginated sessions derived from events. `from` and `to` are optional ISO date filters applied to the server-set event `timestamp`.

```json
{
  "data": [
    {
      "session_id": "0f2a7f90-7f30-48d8-a4fd-1685f681ef91",
      "event_count": 12,
      "first_seen": "2026-06-22T05:10:00.000Z",
      "last_seen": "2026-06-22T05:15:00.000Z",
      "pages_visited": 1
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "total_pages": 1 }
}
```

### `GET /api/sessions/:sessionId/events`

Returns ordered events for one session. Supports the same optional `from` and `to` timestamp filters. Returns `404` when the session has no events in the selected range.

### `GET /api/heatmap?page_url=http%3A%2F%2Flocalhost%3A4000%2Fdemo.html&from=2026-06-22T00:00:00.000Z&to=2026-06-22T23:59:59.999Z`

Returns click coordinates and captured viewport dimensions for the selected page. `from` and `to` are optional ISO date filters.

```json
{
  "data": [
    {
      "timestamp": "2026-06-22T05:11:00.000Z",
      "x": 320,
      "y": 480,
      "viewport_width": 1440,
      "viewport_height": 900
    }
  ]
}
```

### `GET /api/pages`

Returns distinct tracked page URLs for the dashboard dropdown. Supports optional `from`, `to`, and `event_type=page_view|click` filters so views can request pages relevant to their query type.

### `POST /api/funnels/analyze`

Analyzes ordered page-view progression by session. `steps` must contain 2-4 exact tracked page URLs. A session only reaches a later step if the matching `page_view` occurs after the previous matched step timestamp.

Request:

```json
{
  "steps": [
    "http://localhost:4000/demo.html",
    "http://localhost:4000/demo.html#products"
  ]
}
```

Response:

```json
{
  "data": [
    {
      "step": "http://localhost:4000/demo.html",
      "stepIndex": 1,
      "sessionsReached": 42,
      "conversionRate": 100,
      "dropoffFromPrevious": null
    },
    {
      "step": "http://localhost:4000/demo.html#products",
      "stepIndex": 2,
      "sessionsReached": 18,
      "conversionRate": 42.857142857142854,
      "dropoffFromPrevious": 57.14285714285714
    }
  ]
}
```

All errors use:

```json
{ "error": { "message": "Validation message", "code": "VALIDATION_ERROR" } }
```

## Database Design

`events` documents contain:

- `session_id`
- `event_type`: `page_view` or `click`
- `page_url`
- `timestamp`: server-set canonical time
- `client_timestamp`: browser-sent time for clock-skew debugging
- `x`, `y`, `viewport_width`, `viewport_height`: click events only
- `user_agent`

Indexes:

- `{ session_id: 1, timestamp: 1 }`: supports the ordered journey view.
- `{ page_url: 1, event_type: 1 }`: supports heatmap lookup by page URL and click type.

There is no `sessions` collection. That avoids double-writes and drift, at the cost of aggregating over the events collection for the sessions table. For a larger dataset, I would add rollups or materialized session summaries with an explicit reconciliation path.

## Cross-Cutting Backend Choices

- CORS uses an explicit `ALLOWED_ORIGINS` allowlist, not `*`.
- Ingestion is rate-limited with `express-rate-limit`, keyed by session id when present and otherwise IP.
- Errors flow through centralized middleware with a consistent JSON shape.
- `morgan` logs requests so ingestion traffic is visible during development.
- Secrets and deploy-specific URLs are read from environment variables only.

## Tracker Behavior

The tracker uses a 30-minute inactivity timeout before creating a new session id, matching the common analytics default. It persists the session record in `localStorage` and falls back to a cookie if storage is unavailable. Clicks use `pageX` and `pageY` so scroll position does not corrupt coordinates. Interval flushes use `fetch` so failed batches can be requeued; unload and hidden-tab flushes use `sendBeacon` because it is designed to complete during navigation without blocking the host page.

Failed interval batches are requeued and the queue is capped at 200 events. That avoids silent loss during transient outages while preventing a dead backend from growing memory without bound.

## Assumptions And Trade-Offs

- Idempotency keys are not implemented, so a retry could duplicate events if the server inserted a batch but the client did not receive the response. In production I would add client-generated event ids and a unique index.
- Heatmap scaling maps raw page coordinates into a neutral dashboard grid using the captured viewport dimensions. This is approximate for responsive pages where element positions shift between viewport sizes.
- Dashboard authentication is omitted for scope. A production analytics dashboard should require auth and tenant isolation.
- The tracker intentionally captures only page views and clicks. Scroll depth, element metadata, referrer, and custom events would be natural additions.
- Deployment files are environment-ready, but live Render/Vercel/Atlas URLs must be created in those platforms and added to `ALLOWED_ORIGINS` and `NEXT_PUBLIC_API_URL`.

## Deployment

1. Create a MongoDB Atlas free cluster and copy the connection string.
2. Create a Render Web Service from `backend/`.
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment: `MONGO_URI`, `PORT`, `ALLOWED_ORIGINS`
3. Create a Vercel project from `frontend/`.
   - Set `NEXT_PUBLIC_API_URL` to the Render backend URL.
4. Update backend `ALLOWED_ORIGINS` with the deployed Vercel origin and redeploy the backend.

Live demo links:

- Frontend: add Vercel URL after deployment.
- Backend demo page: add Render `/demo.html` URL after deployment.
