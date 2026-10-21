export function getSourceAnchorId(messageId, sourceNumber) {
  return `source-${messageId}-${sourceNumber}`;
}

export default function SourceCard({ source, messageId, isDebugMode }) {
  const whereInSource =
    source.start && source.end ? `${source.start}–${source.end}` : source.start || source.location || null;

  return (
    <article className="source-card" id={getSourceAnchorId(messageId, source.source_number)}>
      <div className="source-card-header">
        <span className="source-number">{source.source_number}</span>
        <div className="source-card-heading">
          <a className="source-title" href={source.url} target="_blank" rel="noopener noreferrer">
            {source.title}
          </a>
          <div className="source-meta">
            {source.source_type && <span className="source-type">{source.source_type}</span>}
            {whereInSource && <span className="source-where">{whereInSource}</span>}
            {isDebugMode && typeof source.score === 'number' && (
              <span className="source-score">score {source.score.toFixed(3)}</span>
            )}
          </div>
        </div>
      </div>
      <blockquote className="source-quote">{source.quote}</blockquote>
    </article>
  );
}
