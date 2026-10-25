import NewChatButton from './NewChatButton.jsx';
import SessionItem from './SessionItem.jsx';

export default function Sidebar({
  sessions,
  activeSessionId,
  isSidebarOpen,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onClose,
}) {
  return (
    <>
      {isSidebarOpen && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={isSidebarOpen ? 'sidebar open' : 'sidebar'} aria-label="Conversation history">
        <NewChatButton onNewChat={onNewChat} />
        <h2 className="sidebar-heading">Conversation history</h2>
        {sessions.length === 0 ? (
          <p className="sidebar-empty">No conversations yet.</p>
        ) : (
          <ul className="session-list">
            {sessions.map((session) => (
              <SessionItem
                key={session.session_id}
                session={session}
                isActive={session.session_id === activeSessionId}
                onSelect={onSelectSession}
                onDelete={onDeleteSession}
                onRename={onRenameSession}
              />
            ))}
          </ul>
        )}
      </aside>
    </>
  );
}
