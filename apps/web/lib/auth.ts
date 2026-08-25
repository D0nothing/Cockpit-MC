import { getApiUrl, object, string } from './data';

export type AuthSession =
  | { authenticated: false }
  | { authenticated: true; login: string; expiresAt: string };

export async function getAuthSession(): Promise<AuthSession> {
  const apiUrl = getApiUrl('/auth/session');
  if (!apiUrl) throw new Error('API is not configured');
  const response = await fetch(apiUrl, { cache: 'no-store', credentials: 'include', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Authentication check failed (${response.status})`);
  const input = object(await response.json() as unknown, 'Authentication session');
  if (input.authenticated !== true) return { authenticated: false };
  return { authenticated: true, login: string(input.login, 'Authentication session.login'), expiresAt: string(input.expiresAt, 'Authentication session.expiresAt') };
}

export function githubLoginUrl(): string | null {
  return getApiUrl('/auth/github/start');
}

export async function logout(): Promise<void> {
  const apiUrl = getApiUrl('/auth/logout');
  if (!apiUrl) throw new Error('API is not configured');
  const response = await fetch(apiUrl, { method: 'POST', credentials: 'include', signal: AbortSignal.timeout(10_000) });
  if (!response.ok && response.status !== 204) throw new Error(`Logout failed (${response.status})`);
}
