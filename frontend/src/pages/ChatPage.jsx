import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ApiError,
  createSession,
  deleteSession,
  getSession,
  listSessions,
  renameSession,
  sendMessage,
} from '../api/client';
import { MAX_QUESTION_LENGTH, ROLE_USER } from '../constants';
import NavBar from '../components/NavBar.jsx';
import Sidebar from '../components/Sidebar.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import ChatInput from '../components/ChatInput.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';

const byNewestFirst = (a, b) => (a.updated_at < b.updated_at ? 1 : -1);

export default function ChatPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [errorCode, setErrorCode] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const lastQuestionRef = useRef('');
  const loadRequestRef = useRef(0);
  const activeSessionRef = useRef(null);
  const isOpeningDefaultRef = useRef(false);

  // Debug mode (shows similarity scores and response times): open the app with ?debug=1
  const isDebugMode = new URLSearchParams(location.search).get('debug') === '1';

  const trimmedLength = questionInput.trim().length;
  const canSend =
    trimmedLength > 0 &&
    questionInput.length <= MAX_QUESTION_LENGTH &&
    !isSending &&
    !isLoadingSession &&
    activeSessionId !== null;

  // ---------- helpers ----------

  const clearError = () => {
    setErrorCode(null);
    setErrorMessage(null);
  };

  const showError = (error) => {
    const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
    let message = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
    if (code === 'LLM_UNAVAILABLE') message = 'The assistant is temporarily unavailable.';
    if (code === 'QUESTION_TOO_LONG') message = `Please keep your question under ${MAX_QUESTION_LENGTH} characters.`;
    setErrorCode(code);
    setErrorMessage(message);
  };

  const goToSession = (id, options) => navigate(`/chat/${id}${location.search}`, options);

  const upsertSession = (session) => {
    setSessions((previous) =>
      [session, ...previous.filter((item) => item.session_id !== session.session_id)].sort(byNewestFirst),
    );
  };

  const refreshSessions = async () => {
    try {
      const list = await listSessions();
      setSessions(list);
      return list;
    } catch (error) {
      showError(error);
      return [];
    }
  };

  const startFreshChat = async (options) => {
    const session = await createSession();
    upsertSession(session);
    goToSession(session.session_id, options);
  };

  const openDefaultChat = async () => {
    if (isOpeningDefaultRef.current) return;
    isOpeningDefaultRef.current = true;
    try {
      const list = await refreshSessions();
      if (list.length > 0) {
        goToSession(list[0].session_id, { replace: true });
      } else {
        await startFreshChat({ replace: true });
      }
    } catch (error) {
      showError(error);
    } finally {
      isOpeningDefaultRef.current = false;
    }
  };

  // ---------- handlers (contract section 8.5) ----------

  // Loads a chat from history and shows its messages.
  const handleSelectSession = async (id) => {
    const requestId = ++loadRequestRef.current;
    activeSessionRef.current = id;
    setActiveSessionId(id);
    setMessages([]);
    setIsLoadingSession(true);
    try {
      const { session, messages: loadedMessages } = await getSession(id);
      if (requestId !== loadRequestRef.current) return;
      setMessages(loadedMessages);
      setSessions((previous) =>
        previous.map((item) => (item.session_id === session.session_id ? session : item)),
      );
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      showError(error);
      if (error instanceof ApiError && error.code === 'SESSION_NOT_FOUND') {
        try {
          await startFreshChat({ replace: true });
          await refreshSessions();
        } catch (innerError) {
          showError(innerError);
        }
      }
    } finally {
      if (requestId === loadRequestRef.current) setIsLoadingSession(false);
    }
  };

  const handleNewChat = async () => {
    clearError();
    setIsSidebarOpen(false);
    // An empty chat is already open – no need to create another one.
    if (activeSessionId && messages.length === 0 && !isLoadingSession) return;
    setMessages([]);
    setQuestionInput('');
    try {
      await startFreshChat();
    } catch (error) {
      showError(error);
    }
  };

  const handleSend = async (questionOverride) => {
    const question = (typeof questionOverride === 'string' ? questionOverride : questionInput).trim();
    const targetSessionId = activeSessionId;
    if (!question || question.length > MAX_QUESTION_LENGTH || isSending || !targetSessionId) return;

    lastQuestionRef.current = question;
    clearError();
    setIsSending(true);
    setQuestionInput('');

    // Show the question straight away; replaced by the real message when the answer arrives.
    const pendingId = `pending-${Date.now()}`;
    setMessages((previous) => [
      ...previous,
      {
        message_id: pendingId,
        session_id: targetSessionId,
        role: ROLE_USER,
        content: question,
        sources: [],
        is_fallback: false,
        response_time_ms: null,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const { session, user_message, assistant_message } = await sendMessage(targetSessionId, question);
      upsertSession(session);
      if (activeSessionRef.current === targetSessionId) {
        setMessages((previous) => [
          ...previous.filter((message) => message.message_id !== pendingId),
          user_message,
          assistant_message,
        ]);
      }
    } catch (error) {
      if (activeSessionRef.current === targetSessionId) {
        setMessages((previous) => previous.filter((message) => message.message_id !== pendingId));
        setQuestionInput(question);
      }
      showError(error);
      if (error instanceof ApiError && error.code === 'SESSION_NOT_FOUND') {
        try {
          await startFreshChat({ replace: true });
          await refreshSessions();
        } catch (innerError) {
          showError(innerError);
        }
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteSession = async (id) => {
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    clearError();
    try {
      await deleteSession(id);
      const list = await refreshSessions();
      if (id === activeSessionId) {
        if (list.length > 0) goToSession(list[0].session_id, { replace: true });
        else await startFreshChat({ replace: true });
      }
    } catch (error) {
      showError(error);
    }
  };

  const handleRenameSession = async (id, title) => {
    try {
      const session = await renameSession(id, title);
      setSessions((previous) =>
        previous.map((item) => (item.session_id === session.session_id ? session : item)),
      );
    } catch (error) {
      showError(error);
    }
  };

  const handleExampleClick = (question) => {
    setQuestionInput(question);
    handleSend(question);
  };

  const handleRetry = () => {
    if (lastQuestionRef.current) handleSend(lastQuestionRef.current);
    else clearError();
  };

  // ---------- effects ----------

  useEffect(() => {
    if (sessionId) {
      handleSelectSession(sessionId);
    } else {
      openDefaultChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    // On "/" the sidebar list is loaded by openDefaultChat.
    if (sessionId) refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- render ----------

  return (
    <div className="app-shell">
      <NavBar onToggleSidebar={() => setIsSidebarOpen((open) => !open)} />
      <div className="chat-layout">
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          isSidebarOpen={isSidebarOpen}
          onNewChat={handleNewChat}
          onSelectSession={(id) => {
            clearError();
            setIsSidebarOpen(false);
            if (id !== activeSessionId) goToSession(id);
          }}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="chat-main">
          <ErrorBanner
            errorCode={errorCode}
            errorMessage={errorMessage}
            onRetry={handleRetry}
            onDismiss={clearError}
          />
          <ChatWindow
            messages={messages}
            isSending={isSending}
            isLoadingSession={isLoadingSession}
            isDebugMode={isDebugMode}
            onExampleClick={handleExampleClick}
          />
          <ChatInput
            questionInput={questionInput}
            onQuestionChange={setQuestionInput}
            onSend={() => handleSend()}
            canSend={canSend}
            isSending={isSending}
          />
        </main>
      </div>
    </div>
  );
}
