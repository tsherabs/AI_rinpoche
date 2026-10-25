import { useEffect, useState } from 'react';
import { ApiError, getAbout, getHealth } from '../api/client';
import NavBar from '../components/NavBar.jsx';

function formatDate(isoString) {
  if (!isoString) return '–';
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? '–' : date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function AboutPage() {
  const [aboutStats, setAboutStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      try {
        const [about, healthResult] = await Promise.all([getAbout(), getHealth().catch(() => null)]);
        if (isCancelled) return;
        setAboutStats(about);
        setHealth(healthResult);
      } catch (error) {
        if (isCancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : 'Could not load statistics.');
      }
    }

    load();
    return () => {
      isCancelled = true;
    };
  }, []);

  const stats = aboutStats
    ? [
        { label: 'Sources', value: aboutStats.source_count },
        { label: 'Passages', value: aboutStats.passage_count },
        { label: 'Hours of teaching', value: aboutStats.total_hours },
        { label: 'Languages', value: aboutStats.languages.join(', ') },
        { label: 'Last updated', value: formatDate(aboutStats.last_updated) },
      ]
    : [];

  return (
    <div className="app-shell">
      <NavBar />
      <main className="about-page">
        <h1>About AI Rinpoche</h1>

        <section className="about-section">
          <h2>Purpose</h2>
          <p>
            AI Rinpoche lets you ask questions about the teachings of Shechen Rabjam Rinpoche and
            receive answers drawn only from a collection of his talks and documents. Every answer
            shows the passages it is based on, so you can go back to the original source.
          </p>
        </section>

        <section className="about-section">
          <h2>The collection</h2>
          {errorMessage && <p className="about-error">{errorMessage}</p>}
          {!aboutStats && !errorMessage && <p className="loading-text">Loading…</p>}
          {aboutStats && (
            <>
              <dl className="stat-grid">
                {stats.map((stat) => (
                  <div className="stat" key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd>{stat.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="about-footnote">
                Answers are generated with the model <code>{aboutStats.llm_model}</code>
                {health && (
                  <>
                    {' '}
                    · service status:{' '}
                    <span className={health.status === 'ok' ? 'status-ok' : 'status-degraded'}>
                      {health.status}
                    </span>
                  </>
                )}
                .
              </p>
            </>
          )}
        </section>

        <section className="about-section">
          <h2>Limitations</h2>
          <ul>
            <li>It can only answer from the teachings in its collection, which is small.</li>
            <li>
              If nothing relevant is found, it says so instead of guessing. Try rephrasing your question.
            </li>
            <li>Answers are written by an AI model and can contain mistakes. Please check the cited sources.</li>
            <li>This is a prototype and not a substitute for a teacher.</li>
          </ul>
        </section>

        {/* TODO(team): replace the placeholders below with the agreed final text. */}
        <section className="about-section">
          <h2>Permissions</h2>
          <p className="placeholder">Text about permissions for the use of the teachings to be added by the team.</p>
        </section>

        <section className="about-section">
          <h2>Team</h2>
          <p className="placeholder">Team members to be added.</p>
        </section>

        <section className="about-section">
          <h2>Guides</h2>
          <p className="placeholder">Links to user guides to be added.</p>
        </section>
      </main>
    </div>
  );
}
