export function getSourceAnchorId(messageId, sourceNumber) {
  return `source-${messageId}-${sourceNumber}`;
}

// One card per video/document: number, title, and its link.
// The backend already merges passages from the same source (one card per source_id).
export default function SourceCard({ source, messageId, isDebugMode }) {
  const hasUrl = Boolean(source.url);

  return (
    <article className="source-card" id={getSourceAnchorId(messageId, source.source_number)}>
      <div className="source-card-header">
        <span className="source-number">{source.source_number}</span>
        <div className="source-card-heading">
          <div className="source-title">{source.title}</div>
          {hasUrl && (
            <a className="source-url" href={source.url} target="_blank" rel="noopener noreferrer">
              {source.url}
            </a>
          )}
          {isDebugMode && typeof source.score === 'number' && (
            <div className="source-meta">
              <span className="source-score">score {source.score.toFixed(3)}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
