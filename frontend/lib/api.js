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

export async function fetchSessions(page = 1, limit = 20) {
  return request(`/api/sessions?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`);
}

export async function fetchSessionEvents(sessionId) {
  return request(`/api/sessions/${encodeURIComponent(sessionId)}/events`);
}

export async function fetchPages() {
  return request('/api/pages');
}

export async function fetchHeatmap(pageUrl) {
  return request(`/api/heatmap?page_url=${encodeURIComponent(pageUrl)}`);
}

export { API_URL };
