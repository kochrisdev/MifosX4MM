import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TokenPair, AuthUser, ApiResponse } from '@mifos-x/shared-types';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api = axios.create({ baseURL: `${BASE}/api/v1`, timeout: 20_000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('no refresh token');
        const { data } = await axios.post<ApiResponse<TokenPair>>(
          `${BASE}/api/v1/auth/refresh`,
          { refreshToken }
        );
        await AsyncStorage.setItem('accessToken', data.data!.accessToken);
        await AsyncStorage.setItem('refreshToken', data.data!.refreshToken);
        original.headers.Authorization = `Bearer ${data.data!.accessToken}`;
        return api(original);
      } catch {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
        // Let the auth context handle navigation to login
        throw err;
      }
    }
    return Promise.reject(err);
  }
);

export async function login(username: string, password: string): Promise<AuthUser> {
  const { data } = await axios.post<ApiResponse<TokenPair>>(`${BASE}/api/v1/auth/login`, {
    username,
    password,
  });
  await AsyncStorage.setItem('accessToken', data.data!.accessToken);
  await AsyncStorage.setItem('refreshToken', data.data!.refreshToken);

  const me = await api.get<ApiResponse<AuthUser>>('/auth/me');
  return me.data.data!;
}

export async function logout(): Promise<void> {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (refreshToken) {
    await api.post('/auth/logout', { refreshToken }).catch(() => {});
  }
  await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const token = await AsyncStorage.getItem('accessToken');
  if (!token) return null;
  try {
    const me = await api.get<ApiResponse<AuthUser>>('/auth/me');
    return me.data.data ?? null;
  } catch {
    return null;
  }
}
