const RETRYABLE_CODES = ['LLM_UNAVAILABLE', 'INTERNAL_ERROR'];

export default function ErrorBanner({ errorCode, errorMessage, onRetry, onDismiss }) {
  if (!errorMessage) return null;

  const canRetry = RETRYABLE_CODES.includes(errorCode) && onRetry;

  return (
    <div className="error-banner" role="alert">
      <span className="error-text">{errorMessage}</span>
      <div className="error-actions">
        {canRetry && (
          <button type="button" className="error-button" onClick={onRetry}>
            Retry
          </button>
        )}
        <button type="button" className="error-button subtle" onClick={onDismiss} aria-label="Dismiss error">
          ✕
        </button>
      </div>
    </div>
  );
}
