export default function TypingIndicator() {
  return (
    <div className="message message-assistant" role="status" aria-live="polite">
      <div className="bubble typing">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
        <span className="typing-label">Searching the teachings…</span>
      </div>
    </div>
  );
}
