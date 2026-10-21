import { useEffect, useRef } from 'react';
import { MAX_QUESTION_LENGTH } from '../constants';
import SendButton from './SendButton.jsx';

export default function ChatInput({ questionInput, onQuestionChange, onSend, canSend, isSending }) {
  const textareaRef = useRef(null);
  const length = questionInput.length;
  const isTooLong = length > MAX_QUESTION_LENGTH;
  const isBlank = questionInput.trim().length === 0;

  // Grow the textarea with its content (up to a limit).
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }, [questionInput]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSend();
    }
  };

  let hint = 'Press Enter to send, Shift+Enter for a new line.';
  if (isTooLong) hint = `Please keep your question under ${MAX_QUESTION_LENGTH} characters.`;
  else if (isBlank) hint = 'Type a question about Rinpoche’s teachings to begin.';

  return (
    <div className="chat-input-area">
      <div className="chat-input-row">
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={questionInput}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question…"
          rows={1}
          disabled={isSending}
          aria-label="Your question"
        />
        <SendButton onSend={onSend} disabled={!canSend} />
      </div>
      <div className="chat-input-footer">
        <span className={isTooLong ? 'input-hint error' : 'input-hint'}>{hint}</span>
        <span className={isTooLong ? 'char-counter error' : 'char-counter'}>
          {length} / {MAX_QUESTION_LENGTH}
        </span>
      </div>
    </div>
  );
}
