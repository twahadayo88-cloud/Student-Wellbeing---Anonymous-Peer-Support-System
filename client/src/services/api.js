import axios from 'axios';

/**
 * PeerBridge — Axios API Client
 * ===============================
 * Centralised HTTP client with:
 *  - Base URL from environment
 *  - Auto-attached JWT token
 *  - Response/error interceptors
 */

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor — attach JWT token if available.
 */
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('pb_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor — handle 401 (expired token) globally.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const msg = error.response.data?.message;
      if (msg) {
        sessionStorage.setItem('auth_error', msg);
      }
      // Token expired or invalid — clear auth and redirect
      sessionStorage.removeItem('pb_token');
      sessionStorage.removeItem('pb_user');
      // Also clear legacy localStorage if present
      localStorage.removeItem('pb_token');
      localStorage.removeItem('pb_user');

      // Only redirect if not already on login/register page
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
