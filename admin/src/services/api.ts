import axios from 'axios';

const API_BASE = 'https://api.atmyhome.tech/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const rt = localStorage.getItem('admin_refresh_token');
        if (rt) {
          const res = await axios.post(`${API_BASE}/admin/login/refresh`, { refresh_token: rt });
          // (refresh endpoint below is separate; keep read-only here)
          localStorage.setItem('admin_access_token', res.data.access_token);
          if (res.data.refresh_token) localStorage.setItem('admin_refresh_token', res.data.refresh_token);
          original.headers.Authorization = `Bearer ${res.data.access_token}`;
          return api(original);
        }
      } catch {
        /* fall through to logout */
      }
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
