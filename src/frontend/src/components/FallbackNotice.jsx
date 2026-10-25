// Styling wrapper for answers with is_fallback === true.
// The text itself comes from the backend (message.content) – never hard-code it here.
export default function FallbackNotice({ children }) {
  return (
    <div className="fallback-notice" role="note">
      <span className="fallback-icon" aria-hidden="true">
        ◌
      </span>
      <div>{children}</div>
    </div>
  );
}
