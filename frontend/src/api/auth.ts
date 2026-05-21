import { apiBaseUrl } from '@/config/env';
import { readData } from './client';

const authTokenKey = 'japan-trip-auth-token';

export type AuthSession = {
  token: string;
  expiresAt: string;
  username: string;
};

export type AuthSessionStatus = {
  authenticated: boolean;
  username: string;
};

type WebAuthnCredentialDescriptor = {
  type: 'public-key';
  id: string;
};

type WebAuthnRegistrationOptions = {
  challenge: string;
  rp: PublicKeyCredentialRpEntity;
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout: number;
  authenticatorSelection: AuthenticatorSelectionCriteria;
  attestation: AttestationConveyancePreference;
  excludeCredentials: WebAuthnCredentialDescriptor[];
};

type WebAuthnAuthenticationOptions = {
  challenge: string;
  timeout: number;
  rpId: string;
  userVerification: UserVerificationRequirement;
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

export async function login(username: string, password: string) {
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return readData<AuthSession>(response, '로그인하지 못했습니다.');
}

export async function registerPasskey() {
  if (!(await canUsePlatformPasskey())) return false;

  const optionsResponse = await fetch(`${apiBaseUrl}/api/auth/passkey/register-options`, {
    method: 'POST',
    headers: authHeaders()
  });
  const options = await readData<WebAuthnRegistrationOptions>(optionsResponse, 'Face ID 등록을 시작하지 못했습니다.');

  const credential = (await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: base64UrlToArrayBuffer(options.challenge),
      user: {
        ...options.user,
        id: base64UrlToArrayBuffer(options.user.id)
      },
      excludeCredentials: options.excludeCredentials.map((descriptor) => ({
        ...descriptor,
        id: base64UrlToArrayBuffer(descriptor.id)
      }))
    }
  })) as PublicKeyCredential | null;

  if (!credential) return false;

  const response = credential.response as AuthenticatorAttestationResponse;
  const registerResponse = await fetch(`${apiBaseUrl}/api/auth/passkey/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      id: credential.id,
      rawId: arrayBufferToBase64Url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
        attestationObject: arrayBufferToBase64Url(response.attestationObject)
      }
    })
  });

  await readData<{ registered: boolean }>(registerResponse, 'Face ID 등록을 완료하지 못했습니다.');
  return true;
}

export async function loginWithPasskey() {
  if (!(await canUsePlatformPasskey())) {
    throw new Error('이 브라우저에서는 Face ID 로그인을 사용할 수 없습니다.');
  }

  const optionsResponse = await fetch(`${apiBaseUrl}/api/auth/passkey/login-options`, {
    method: 'POST'
  });
  const options = await readData<WebAuthnAuthenticationOptions>(optionsResponse, 'Face ID 로그인을 시작하지 못했습니다.');
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: base64UrlToArrayBuffer(options.challenge),
    timeout: options.timeout,
    rpId: options.rpId,
    userVerification: options.userVerification
  };

  const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!credential) throw new Error('Face ID 인증이 취소되었습니다.');

  const response = credential.response as AuthenticatorAssertionResponse;
  const loginResponse = await fetch(`${apiBaseUrl}/api/auth/passkey/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: credential.id,
      rawId: arrayBufferToBase64Url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
        authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
        signature: arrayBufferToBase64Url(response.signature),
        userHandle: response.userHandle ? arrayBufferToBase64Url(response.userHandle) : null
      }
    })
  });

  return readData<AuthSession>(loginResponse, 'Face ID로 로그인하지 못했습니다.');
}

export async function verifySession() {
  const response = await fetch(`${apiBaseUrl}/api/auth/session`, {
    headers: authHeaders()
  });
  if (!response.ok) return null;
  return readData<AuthSessionStatus>(response, '세션을 확인하지 못했습니다.');
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const response = await fetch(`${apiBaseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ currentPassword, newPassword })
  });
  return readData<AuthSession>(response, '비밀번호를 변경하지 못했습니다.');
}

export async function canUsePlatformPasskey() {
  if (!window.PublicKeyCredential || !window.isSecureContext) return false;

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function base64UrlToArrayBuffer(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
