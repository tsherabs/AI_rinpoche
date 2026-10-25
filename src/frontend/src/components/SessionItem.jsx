import { useState } from 'react';

export default function SessionItem({ session, isActive, onSelect, onDelete, onRename }) {
  const [isEditing, setIsEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(session.title);

  const startEditing = () => {
    setTitleDraft(session.title);
    setIsEditing(true);
  };

  const commitRename = () => {
    const trimmed = titleDraft.trim();
    setIsEditing(false);
    if (trimmed && trimmed !== session.title) {
      onRename(session.session_id, trimmed);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') commitRename();
    if (event.key === 'Escape') setIsEditing(false);
  };

  return (
    <li className={isActive ? 'session-item active' : 'session-item'}>
      {isEditing ? (
        <input
          className="session-rename-input"
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          maxLength={60}
          autoFocus
          aria-label="Chat title"
        />
      ) : (
        <button
          type="button"
          className="session-title"
          onClick={() => onSelect(session.session_id)}
          onDoubleClick={startEditing}
          title={session.title}
        >
          {session.title}
        </button>
      )}
      {!isEditing && (
        <div className="session-actions">
          <button type="button" className="icon-button" onClick={startEditing} aria-label="Rename chat" title="Rename">
            ✎
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => onDelete(session.session_id)}
            aria-label="Delete chat"
            title="Delete"
          >
            🗑
          </button>
        </div>
      )}
    </li>
  );
}
