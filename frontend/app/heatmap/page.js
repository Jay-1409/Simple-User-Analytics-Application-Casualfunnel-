'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchHeatmap, fetchPages } from '../../lib/api';

export default function HeatmapPage() {
  const frameRef = useRef(null);
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState('');
  const [clicks, setClicks] = useState([]);
  const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });
  const [loadingPages, setLoadingPages] = useState(true);
  const [loadingClicks, setLoadingClicks] = useState(false);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const referenceWidth = Math.max(1024, ...clicks.map((click) => Number(click.viewport_width) || 0));
  const referenceViewportHeight = Math.max(720, ...clicks.map((click) => Number(click.viewport_height) || 0));
  const maxObservedY = Math.max(700, ...clicks.map((click) => Number(click.y) || 0));
  const referenceHeight = Math.max(referenceViewportHeight, Math.ceil(maxObservedY + 120));
  const canvasWidth = Math.max(1, frameSize.width);
  const canvasHeight = Math.max(1, frameSize.height);

  useEffect(() => {
    let active = true;
    setLoadingPages(true);

    fetchPages()
      .then((payload) => {
        if (!active) return;
        const values = payload.data || [];
        setPages(values);
        setSelectedPage(values[0] || '');
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoadingPages(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPage) {
      setClicks([]);
      return;
    }

    let active = true;
    setLoadingClicks(true);
    setError('');

    fetchHeatmap(selectedPage)
      .then((payload) => {
        if (active) setClicks(payload.data || []);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoadingClicks(false);
      });

    return () => {
      active = false;
    };
  }, [selectedPage, refreshToken]);

  useEffect(() => {
    function measure() {
      if (!frameRef.current) return;
      const rect = frameRef.current.getBoundingClientRect();
      setFrameSize({ width: rect.width || 1, height: rect.height || 1 });
    }

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <>
      <div className="pageHeader">
        <div>
          <h1>Heatmap</h1>
          <p>Click density by normalized page coordinates.</p>
        </div>
      </div>

      <div className="toolbar">
        <select value={selectedPage} onChange={(event) => setSelectedPage(event.target.value)} disabled={loadingPages || pages.length === 0}>
          {pages.length === 0 ? <option>No tracked pages</option> : null}
          {pages.map((page) => (
            <option key={page} value={page}>
              {page}
            </option>
          ))}
        </select>
        <button
          className="button"
          type="button"
          disabled={!selectedPage || loadingClicks}
          onClick={() => setRefreshToken((value) => value + 1)}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <section className="panel">
        {loadingPages || loadingClicks ? <div className="status">Loading heatmap data...</div> : null}
        {!loadingPages && !loadingClicks && !selectedPage ? <div className="status">No tracked pages yet.</div> : null}
        {!loadingPages && !loadingClicks && selectedPage && clicks.length === 0 ? <div className="status">No clicks recorded for this page yet.</div> : null}
        <div className="heatmapFrame" ref={frameRef}>
          <div className="heatmapScaleLabel">
            {clicks.length} clicks · {Math.round(referenceWidth)}px reference width · {Math.round(referenceHeight)}px page range
          </div>
          <div className="heatmapOverlay" aria-hidden="true">
            {clicks.map((click, index) => {
              const eventViewportWidth = Math.max(1, Number(click.viewport_width) || referenceWidth);
              const left = ((Number(click.x) || 0) / eventViewportWidth) * canvasWidth;
              const top = ((Number(click.y) || 0) / referenceHeight) * canvasHeight;

              return (
                <span
                  className="heatmapDot"
                  key={`${click.timestamp}-${index}`}
                  style={{
                    left: `${Math.max(0, Math.min(canvasWidth, left))}px`,
                    top: `${Math.max(0, Math.min(canvasHeight, top))}px`
                  }}
                  title={`x ${Math.round(Number(click.x))}, y ${Math.round(Number(click.y))}`}
                />
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
