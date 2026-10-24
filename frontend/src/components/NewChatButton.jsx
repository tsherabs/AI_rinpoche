export default function NewChatButton({ onNewChat, disabled }) {
  return (
    <button type="button" className="new-chat-button" onClick={onNewChat} disabled={disabled}>
      + New chat
    </button>
  );
}
