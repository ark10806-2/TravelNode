import { useEffect, useState } from 'react';
import {
  changePassword as changePasswordRequest,
  clearAuthToken,
  getAuthToken,
  login as loginRequest,
  loginWithPasskey as loginWithPasskeyRequest,
  registerPasskey,
  setAuthToken,
  verifySession
} from '@/api/auth';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAuthToken()));
  const [username, setUsername] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(Boolean(getAuthToken()));

  useEffect(() => {
    if (!getAuthToken()) return;

    void verifySession()
      .then((session) => {
        if (!session) {
          clearAuthToken();
          setIsAuthenticated(false);
          setUsername('');
          return;
        }

        setIsAuthenticated(true);
        setUsername(session.username);
      })
      .catch(() => {
        clearAuthToken();
        setIsAuthenticated(false);
        setUsername('');
      })
      .finally(() => setIsCheckingSession(false));
  }, []);

  async function login(username: string, password: string) {
    const session = await loginRequest(username, password);
    setAuthToken(session.token);
    try {
      await registerPasskey();
    } catch (error) {
      console.warn('Passkey registration was not completed.', error);
    }
    setIsAuthenticated(true);
    setUsername(session.username);
  }

  async function loginWithPasskey() {
    const session = await loginWithPasskeyRequest();
    setAuthToken(session.token);
    setIsAuthenticated(true);
    setUsername(session.username);
  }

  function logout() {
    clearAuthToken();
    setIsAuthenticated(false);
    setUsername('');
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const session = await changePasswordRequest(currentPassword, newPassword);
    setAuthToken(session.token);
    setIsAuthenticated(true);
    setUsername(session.username);
  }

  return {
    isAuthenticated,
    isCheckingSession,
    username,
    login,
    loginWithPasskey,
    logout,
    changePassword
  };
}
