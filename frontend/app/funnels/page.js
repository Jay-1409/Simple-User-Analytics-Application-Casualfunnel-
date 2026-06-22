'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Play } from 'lucide-react';
import { analyzeFunnel, fetchPages } from '../../lib/api';

const MIN_STEPS = 2;
const MAX_STEPS = 4;

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export default function FunnelsPage() {
  const [pages, setPages] = useState([]);
  const [steps, setSteps] = useState(['', '']);
  const [result, setResult] = useState([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const validSteps = useMemo(() => steps.every(Boolean) && steps.length >= MIN_STEPS, [steps]);
  const firstStepCount = result[0]?.sessionsReached || 0;
  const maxCount = Math.max(1, firstStepCount);

  useEffect(() => {
    let active = true;
    setLoadingPages(true);

    fetchPages({ eventType: 'page_view' })
      .then((payload) => {
        if (!active) return;
        const values = payload.data || [];
        setPages(values);
        setSteps([values[0] || '', values[1] || values[0] || '']);
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

  function updateStep(index, value) {
    setSteps((current) => current.map((step, stepIndex) => (stepIndex === index ? value : step)));
    setResult([]);
  }

  function addStep() {
    setSteps((current) => (current.length >= MAX_STEPS ? current : [...current, pages[0] || '']));
    setResult([]);
  }

  function removeStep(index) {
    setSteps((current) => current.filter((_step, stepIndex) => stepIndex !== index));
    setResult([]);
  }

  async function runFunnel() {
    if (!validSteps) return;
    setAnalyzing(true);
    setError('');

    try {
      const payload = await analyzeFunnel(steps);
      setResult(payload.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <>
      <div className="pageHeader">
        <div>
          <h1>Funnels</h1>
          <p>Measure ordered page-view progression across sessions.</p>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <section className="panel funnelBuilder">
        <div className="funnelBuilderHeader">
          <div>
            <h2>Step Builder</h2>
            <p>Choose 2-4 tracked pages in the order users should visit them.</p>
            <p className="funnelHint">New hash or history URL changes are recorded as page views; wait a few seconds for batched tracker events to flush.</p>
          </div>
          <button className="button primary" type="button" disabled={!validSteps || analyzing} onClick={runFunnel}>
            <Play size={16} /> {analyzing ? 'Running...' : 'Run funnel'}
          </button>
        </div>

        {loadingPages ? (
          <div className="status">Loading tracked pages...</div>
        ) : pages.length === 0 ? (
          <div className="status">No tracked pages yet. Generate page views from the demo page first.</div>
        ) : (
          <div className="funnelSteps">
            {steps.map((step, index) => (
              <div className="funnelStepRow" key={`${index}-${step}`}>
                <span className="funnelStepNumber">{index + 1}</span>
                <select value={step} onChange={(event) => updateStep(index, event.target.value)}>
                  {pages.map((page) => (
                    <option key={page} value={page}>
                      {page}
                    </option>
                  ))}
                </select>
                <button
                  className="iconButton"
                  type="button"
                  aria-label={`Remove step ${index + 1}`}
                  title={`Remove step ${index + 1}`}
                  disabled={steps.length <= MIN_STEPS}
                  onClick={() => removeStep(index)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button className="button" type="button" disabled={steps.length >= MAX_STEPS} onClick={addStep}>
              <Plus size={16} /> Add step
            </button>
          </div>
        )}
      </section>

      <section className="panel funnelResults">
        {result.length === 0 ? (
          <div className="status">Run a funnel to see conversion and drop-off by step.</div>
        ) : firstStepCount === 0 ? (
          <div className="status">No sessions reached the first selected step in this funnel.</div>
        ) : (
          <div className="funnelChart">
            {result.map((step, index) => {
              const barWidth = Math.max(4, (step.sessionsReached / maxCount) * 100);
              const barHeight = Math.max(22, 38 * (step.sessionsReached / maxCount));
              const opacity = Math.max(0.42, 1 - index * 0.16);

              return (
                <article className="funnelBarRow" key={`${step.stepIndex}-${step.step}`}>
                  <div className="funnelBarHeader">
                    <div>
                      <span className="funnelStepLabel">Step {step.stepIndex}</span>
                      <strong>{step.step}</strong>
                    </div>
                    <span className="funnelMetric">
                      {step.sessionsReached} sessions - {formatPercent(step.conversionRate)}
                    </span>
                  </div>
                  <div className="funnelTrack" style={{ height: `${barHeight}px` }}>
                    <div
                      className="funnelBar"
                      style={{
                        width: `${barWidth}%`,
                        opacity
                      }}
                    />
                  </div>
                  {index > 0 ? (
                    <div className="funnelDropoff">↓ {formatPercent(step.dropoffFromPrevious)} drop-off from previous step</div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
