import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ChatPage from './pages/ChatPage.jsx';
import AboutPage from './pages/AboutPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/chat/:sessionId" element={<ChatPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
