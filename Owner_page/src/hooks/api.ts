import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8081',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor — auto-attach owner JWT ──────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('OWNER_TOKEN');
  if (token && token !== 'pending') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor — 401 = session expired, force re-login ────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear all owner session data and redirect to login
      ['OWNER_TOKEN','OWNER_STORE_ID','OWNER_NAME','OWNER_ID','OWNER_PHONE',
       'OWNER_STORE_NAME','OWNER_IS_APPROVED','OWNER_ROLE'].forEach(k => localStorage.removeItem(k));
      if (!window.location.pathname.startsWith('/')) {
        window.location.href = '/';
      } else {
        window.location.reload(); // triggers the landing page (no token → shows login)
      }
    }
    return Promise.reject(error);
  }
);

export default api;
