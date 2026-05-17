import { apiBaseUrl } from '@/config/env';
import { readData } from './client';

const authTokenKey = 'japan-trip-auth-token';

export type AuthSession = {
  token: string;
  expiresAt: string;
};

export function getAuthToken() {
  return window.localStorage.getItem(authTokenKey);
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(authTokenKey, token);
}

export function clearAuthToken() {
  window.localStorage.removeItem(authTokenKey);
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(password: string) {
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  return readData<AuthSession>(response, '로그인하지 못했습니다.');
}

export async function verifySession() {
  const response = await fetch(`${apiBaseUrl}/api/auth/session`, {
    headers: authHeaders()
  });
  return response.ok;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const response = await fetch(`${apiBaseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ currentPassword, newPassword })
  });
  return readData<AuthSession>(response, '비밀번호를 변경하지 못했습니다.');
}
