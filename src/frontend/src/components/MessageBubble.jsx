import { ROLE_USER } from '../constants';
import FallbackNotice from './FallbackNotice.jsx';
import SourceList from './SourceList.jsx';
import { getSourceAnchorId } from './SourceCard.jsx';

function scrollToSource(messageId, sourceNumber) {
  const element = document.getElementById(getSourceAnchorId(messageId, sourceNumber));
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.classList.add('highlighted');
  window.setTimeout(() => element.classList.remove('highlighted'), 1600);
}

// Turns "[1]" markers into links that scroll to the matching SourceCard.
function renderContent(message) {
  const knownNumbers = new Set((message.sources || []).map((source) => source.source_number));
  const parts = message.content.split(/(\[\d+\])/g);

  return parts.map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return part;
    const sourceNumber = Number(match[1]);
    if (!knownNumbers.has(sourceNumber)) return part;
    return (
      <a
        key={index}
        href={`#${getSourceAnchorId(message.message_id, sourceNumber)}`}
        className="citation-marker"
        onClick={(event) => {
          event.preventDefault();
          scrollToSource(message.message_id, sourceNumber);
        }}
      >
        [{sourceNumber}]
      </a>
    );
  });
}

export default function MessageBubble({ message, isDebugMode }) {
  const isUser = message.role === ROLE_USER;
  const isPending = String(message.message_id).startsWith('pending-');

  const classNames = ['message', isUser ? 'message-user' : 'message-assistant'];
  if (isPending) classNames.push('pending');

  if (isUser) {
    return (
      <div className={classNames.join(' ')}>
        <div className="bubble">{message.content}</div>
      </div>
    );
  }

  return (
    <div className={classNames.join(' ')}>
      <div className="bubble">
        {message.is_fallback ? (
          <FallbackNotice>{message.content}</FallbackNotice>
        ) : (
          <p className="answer-text">{renderContent(message)}</p>
        )}
        {!message.is_fallback && (
          <SourceList sources={message.sources} messageId={message.message_id} isDebugMode={isDebugMode} />
        )}
        {isDebugMode && typeof message.response_time_ms === 'number' && (
          <div className="debug-line">{message.response_time_ms} ms</div>
        )}
      </div>
    </div>
  );
}
