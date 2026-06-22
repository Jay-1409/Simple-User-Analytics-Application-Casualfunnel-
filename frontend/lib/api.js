const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function request(path) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: 'application/json'
    },
    cache: 'no-store'
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body?.error?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body;
}

function appendDateFilters(params, filters = {}) {
  if (filters.from) params.set('from', new Date(filters.from).toISOString());
  if (filters.to) params.set('to', new Date(filters.to).toISOString());
  return params;
}

export async function fetchSessions(page = 1, limit = 20, filters = {}) {
  const params = appendDateFilters(
    new URLSearchParams({
      page: String(page),
      limit: String(limit)
    }),
    filters
  );
  return request(`/api/sessions?${params.toString()}`);
}

export async function fetchSessionEvents(sessionId, filters = {}) {
  const params = appendDateFilters(new URLSearchParams(), filters);
  const query = params.toString();
  return request(`/api/sessions/${encodeURIComponent(sessionId)}/events${query ? `?${query}` : ''}`);
}

export async function fetchPages(filters = {}) {
  const params = appendDateFilters(new URLSearchParams(), filters);
  if (filters.eventType) params.set('event_type', filters.eventType);
  const query = params.toString();
  return request(`/api/pages${query ? `?${query}` : ''}`);
}

export async function fetchHeatmap(pageUrl, filters = {}) {
  const params = appendDateFilters(
    new URLSearchParams({
      page_url: pageUrl
    }),
    filters
  );
  return request(`/api/heatmap?${params.toString()}`);
}

export async function analyzeFunnel(steps) {
  const response = await fetch(`${API_URL}/api/funnels/analyze`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ steps })
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body?.error?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body;
}

export { API_URL };
