export default function SendButton({ onSend, disabled }) {
  return (
    <button type="button" className="send-button" onClick={onSend} disabled={disabled} aria-label="Send question">
      Send
    </button>
  );
}
