// All API calls live here (contract section 8.3).
// API objects are returned as-is, with their snake_case keys.

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const hasBody = body !== undefined;
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      'INTERNAL_ERROR',
      'Could not reach the server. Please check your connection and try again.',
      0,
    );
  }

  if (!response.ok) {
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong. Please try again.';
    try {
      const data = await response.json();
      if (data && data.error) {
        code = data.error.code || code;
        message = data.error.message || message;
      }
    } catch {
      // body was not JSON – keep the generic error
    }
    throw new ApiError(code, message, response.status);
  }

  if (response.status === 204) return null;
  return response.json();
}

const sessionPath = (sessionId) => `/sessions/${encodeURIComponent(sessionId)}`;

export function getHealth() {
  return request('/health');
}

export function getAbout() {
  return request('/about');
}

export function createSession() {
  return request('/sessions', { method: 'POST' });
}

export async function listSessions() {
  const data = await request('/sessions');
  return data.sessions;
}

export function getSession(sessionId) {
  return request(sessionPath(sessionId));
}

export function sendMessage(sessionId, question) {
  return request(`${sessionPath(sessionId)}/messages`, {
    method: 'POST',
    body: { question },
  });
}

export function renameSession(sessionId, title) {
  return request(sessionPath(sessionId), { method: 'PATCH', body: { title } });
}

export async function deleteSession(sessionId) {
  await request(sessionPath(sessionId), { method: 'DELETE' });
}
