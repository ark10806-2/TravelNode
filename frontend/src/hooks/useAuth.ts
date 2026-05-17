import { useEffect, useState } from 'react';
import {
  changePassword as changePasswordRequest,
  clearAuthToken,
  getAuthToken,
  login as loginRequest,
  setAuthToken,
  verifySession
} from '@/api/auth';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAuthToken()));

  useEffect(() => {
    if (!getAuthToken()) return;

    void verifySession().then((valid) => {
      if (!valid) {
        clearAuthToken();
        setIsAuthenticated(false);
      }
    });
  }, []);

  async function login(password: string) {
    const session = await loginRequest(password);
    setAuthToken(session.token);
    setIsAuthenticated(true);
  }

  function logout() {
    clearAuthToken();
    setIsAuthenticated(false);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const session = await changePasswordRequest(currentPassword, newPassword);
    setAuthToken(session.token);
    setIsAuthenticated(true);
  }

  return {
    isAuthenticated,
    login,
    logout,
    changePassword
  };
}
