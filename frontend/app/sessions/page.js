'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchSessions } from '../../lib/api';

const LIMIT = 20;

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium'
  }).format(new Date(value));
}

function shortId(value) {
  if (!value) return '';
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

export default function SessionsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    fetchSessions(page, LIMIT)
      .then((data) => {
        if (active) setPayload(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page]);

  return (
    <>
      <div className="pageHeader">
        <div>
          <h1>Sessions</h1>
          <p>Aggregated from the append-only event log at request time.</p>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <section className="panel">
        {loading ? (
          <div className="status">Loading sessions...</div>
        ) : payload?.data?.length ? (
          <>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Events</th>
                    <th>First seen</th>
                    <th>Last seen</th>
                    <th>Pages</th>
                    <th>Copy</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.data.map((session) => (
                    <tr
                      className="sessionRow"
                      key={session.session_id}
                      onClick={() => router.push(`/sessions/${encodeURIComponent(session.session_id)}`)}
                    >
                      <td className="mono" title={session.session_id}>
                        {shortId(session.session_id)}
                      </td>
                      <td>{session.event_count}</td>
                      <td>{formatDate(session.first_seen)}</td>
                      <td>{formatDate(session.last_seen)}</td>
                      <td>{session.pages_visited}</td>
                      <td>
                        <button
                          className="iconButton"
                          type="button"
                          aria-label="Copy session id"
                          title="Copy session id"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigator.clipboard?.writeText(session.session_id);
                          }}
                        >
                          <Copy size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button className="button" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="muted">
                Page {payload.pagination.page} of {payload.pagination.total_pages || 1}
              </span>
              <button
                className="button"
                type="button"
                disabled={page >= (payload.pagination.total_pages || 1)}
                onClick={() => setPage((value) => value + 1)}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="status">No sessions yet. Open the backend demo page and click around to generate events.</div>
        )}
      </section>
    </>
  );
}
