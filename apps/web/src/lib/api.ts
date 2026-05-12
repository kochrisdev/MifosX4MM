import axios from 'axios';
import type { TokenPair, AuthUser } from '@mifos-x/shared-types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api = axios.create({ baseURL: `${BASE}/api/v1` });

// Attach stored access token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, attempt a token refresh then retry once
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const originalRequest = err.config;
    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post<{ success: boolean; data: TokenPair }>(
          `${BASE}/api/v1/auth/refresh`,
          { refreshToken }
        );
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export async function login(username: string, password: string): Promise<AuthUser> {
  const { data } = await axios.post<{ success: boolean; data: TokenPair }>(
    `${BASE}/api/v1/auth/login`,
    { username, password }
  );
  localStorage.setItem('accessToken', data.data.accessToken);
  localStorage.setItem('refreshToken', data.data.refreshToken);
  // Cookie lets the Next.js middleware verify auth on the server side
  document.cookie = `accessToken=${data.data.accessToken}; path=/; SameSite=Strict`;

  const me = await api.get<{ success: boolean; data: AuthUser }>('/auth/me');
  return me.data.data;
}

export async function logout() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (refreshToken) {
    await api.post('/auth/logout', { refreshToken }).catch(() => {});
  }
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  document.cookie = 'accessToken=; path=/; max-age=0';
  window.location.href = '/login';
}
