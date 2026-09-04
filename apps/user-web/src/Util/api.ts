import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8081',
  timeout: 15000,  // 15s — accommodates slow college networks
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request interceptor — auto-attach JWT token ──────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('user_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor — handle 401 (token expired / revoked) ─────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stale credentials and redirect to login
      localStorage.removeItem('user_info');
      localStorage.removeItem('user_token');
      // Only redirect if not already on login page to avoid redirect loops
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
