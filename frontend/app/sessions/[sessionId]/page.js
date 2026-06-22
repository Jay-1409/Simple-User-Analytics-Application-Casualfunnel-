'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MousePointer2, FileText, ArrowLeft } from 'lucide-react';
import { fetchSessionEvents } from '../../../lib/api';

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium'
  }).format(new Date(value));
}

export default function SessionEventsPage({ params }) {
  const sessionId = decodeURIComponent(params.sessionId);
  const searchParams = useSearchParams();
  const filters = {
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || ''
  };
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    fetchSessionEvents(sessionId, filters)
      .then((payload) => {
        if (active) setEvents(payload.data || []);
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
  }, [sessionId, filters.from, filters.to]);

  return (
    <>
      <div className="pageHeader">
        <div>
          <h1>Session Journey</h1>
          <p className="mono">{sessionId}</p>
          {filters.from || filters.to ? (
            <p>
              Filtered {filters.from ? `from ${filters.from}` : ''} {filters.to ? `to ${filters.to}` : ''}
            </p>
          ) : null}
        </div>
        <Link className="button" href="/sessions">
          <ArrowLeft size={16} /> Back
        </Link>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <section className="panel">
        {loading ? (
          <div className="status">Loading session events...</div>
        ) : events.length ? (
          <div className="timeline">
            {events.map((event, index) => (
              <article className="timelineItem" key={`${event.timestamp}-${index}`}>
                <div className={`timelineIcon ${event.event_type === 'click' ? 'click' : ''}`}>
                  {event.event_type === 'click' ? <MousePointer2 size={18} /> : <FileText size={18} />}
                </div>
                <div className="timelineBody">
                  <h2>{event.event_type === 'click' ? 'Click' : 'Page view'}</h2>
                  <div className="timelineMeta">
                    <span>{formatDate(event.timestamp)}</span>
                    <span>{event.page_url}</span>
                    {event.event_type === 'click' ? (
                      <span>
                        x {Math.round(event.x)}, y {Math.round(event.y)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="status">No events found for this session.</div>
        )}
      </section>
    </>
  );
}
