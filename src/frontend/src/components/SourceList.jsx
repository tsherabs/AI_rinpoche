import SourceCard from './SourceCard.jsx';

export default function SourceList({ sources, messageId, isDebugMode }) {
  if (!sources || sources.length === 0) return null;

  return (
    <section className="source-list" aria-label="Sources">
      <h3 className="source-list-heading">Sources</h3>
      {sources.map((source) => (
        <SourceCard
          key={source.passage_id}
          source={source}
          messageId={messageId}
          isDebugMode={isDebugMode}
        />
      ))}
    </section>
  );
}
