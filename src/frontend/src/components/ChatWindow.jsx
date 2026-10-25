import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import ExampleQuestions from './ExampleQuestions.jsx';

export default function ChatWindow({
  messages,
  isSending,
  isLoadingSession,
  isDebugMode,
  onExampleClick,
}) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  const isEmpty = messages.length === 0;

  return (
    <div className="chat-window">
      <div className="chat-window-inner">
        {isLoadingSession && <p className="loading-text">Loading conversation…</p>}
        {!isLoadingSession && isEmpty && !isSending && (
          <ExampleQuestions onExampleClick={onExampleClick} disabled={isSending} />
        )}
        {messages.map((message) => (
          <MessageBubble key={message.message_id} message={message} isDebugMode={isDebugMode} />
        ))}
        {isSending && <TypingIndicator />}
        <div ref={endRef} />
      </div>
    </div>
  );
}
