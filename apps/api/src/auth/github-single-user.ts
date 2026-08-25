import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError } from '../http';

const developmentLogin = 'local-development';
const oauthStateCookie = 'vistory_oauth_state';
const productionSessionCookie = '__Host-vistory_session';
const developmentSessionCookie = 'vistory_session';
const sessionDurationSeconds = 8 * 60 * 60;
const oauthStateDurationSeconds = 10 * 60;

interface AuthEnvironment {
  NODE_ENV?: string;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  GITHUB_ALLOWED_LOGIN?: string;
  AUTH_SESSION_SECRET?: string;
  APP_PUBLIC_URL?: string;
  API_PUBLIC_URL?: string;
}

export interface SingleUserSession {
  login: string;
  expiresAt: string;
}

interface SessionPayload {
  login: string;
  expiresAt: number;
}

export function githubSingleUserAuthReadiness(environment: AuthEnvironment = process.env) {
  if (environment.NODE_ENV !== 'production') return { ready: true, mode: 'development' as const, issues: [] as string[] };
  const issues: string[] = [];
  if (!bounded(environment.GITHUB_OAUTH_CLIENT_ID, 200)) issues.push('GITHUB_OAUTH_CLIENT_ID');
  if (!bounded(environment.GITHUB_OAUTH_CLIENT_SECRET, 500, 20)) issues.push('GITHUB_OAUTH_CLIENT_SECRET');
  if (!validGitHubLogin(environment.GITHUB_ALLOWED_LOGIN)) issues.push('GITHUB_ALLOWED_LOGIN');
  if (!bounded(environment.AUTH_SESSION_SECRET, 500, 32)) issues.push('AUTH_SESSION_SECRET');
  if (!publicOrigin(environment.APP_PUBLIC_URL, true)) issues.push('APP_PUBLIC_URL');
  if (!publicOrigin(environment.API_PUBLIC_URL, true)) issues.push('API_PUBLIC_URL');
  return { ready: issues.length === 0, mode: 'github-single-user' as const, issues };
}

export function readSingleUserSession(request: IncomingMessage, environment: AuthEnvironment = process.env, now = Date.now()): SingleUserSession | null {
  if (environment.NODE_ENV !== 'production') {
    return { login: environment.GITHUB_ALLOWED_LOGIN?.trim() || developmentLogin, expiresAt: new Date(now + sessionDurationSeconds * 1_000).toISOString() };
  }

  const secret = environment.AUTH_SESSION_SECRET;
  const allowedLogin = environment.GITHUB_ALLOWED_LOGIN;
  if (!bounded(secret, 500, 32) || !validGitHubLogin(allowedLogin)) return null;
  const cookie = cookies(request.headers.cookie)[productionSessionCookie];
  if (!cookie) return null;
  const [encodedPayload, receivedSignature, extra] = cookie.split('.');
  if (!encodedPayload || !receivedSignature || extra) return null;
  const expectedSignature = sign(encodedPayload, secret);
  if (!safeEqual(receivedSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as unknown;
    if (!isSessionPayload(payload) || payload.expiresAt <= now || payload.login.toLowerCase() !== allowedLogin.toLowerCase()) return null;
    return { login: payload.login, expiresAt: new Date(payload.expiresAt).toISOString() };
  } catch {
    return null;
  }
}

export function beginGitHubLogin(response: ServerResponse, environment: AuthEnvironment = process.env): void {
  const configuration = requireConfiguration(environment);
  const state = randomBytes(32).toString('base64url');
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', configuration.clientId);
  authorizeUrl.searchParams.set('redirect_uri', `${configuration.apiOrigin}/api/auth/github/callback`);
  authorizeUrl.searchParams.set('scope', 'read:user');
  authorizeUrl.searchParams.set('state', state);
  response.setHeader('Set-Cookie', cookieHeader(oauthStateCookie, state, oauthStateDurationSeconds, environment, 'Lax'));
  redirect(response, authorizeUrl.toString());
}

export async function completeGitHubLogin(request: IncomingMessage, response: ServerResponse, url: URL, environment: AuthEnvironment = process.env): Promise<void> {
  const configuration = requireConfiguration(environment);
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code') ?? '';
  const expectedState = cookies(request.headers.cookie)[oauthStateCookie] ?? '';
  response.setHeader('Set-Cookie', clearCookie(oauthStateCookie, environment, 'Lax'));
  if (!bounded(state, 200, 20) || !bounded(code, 500, 10) || !safeEqual(state, expectedState)) throw new HttpError(400, 'GitHub OAuth state is invalid');

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Vistory-OS' },
    body: new URLSearchParams({ client_id: configuration.clientId, client_secret: configuration.clientSecret, code, redirect_uri: `${configuration.apiOrigin}/api/auth/github/callback` }),
    signal: AbortSignal.timeout(8_000),
  });
  const tokenBody = await jsonRecord(tokenResponse);
  const accessToken = typeof tokenBody.access_token === 'string' ? tokenBody.access_token : '';
  if (!tokenResponse.ok || !bounded(accessToken, 1_000, 20)) throw new HttpError(502, 'GitHub OAuth token exchange failed');

  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${accessToken}`, 'User-Agent': 'Vistory-OS', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(8_000),
  });
  const userBody = await jsonRecord(userResponse);
  const login = typeof userBody.login === 'string' ? userBody.login : '';
  if (!userResponse.ok || !validGitHubLogin(login)) throw new HttpError(502, 'GitHub user lookup failed');
  if (login.toLowerCase() !== configuration.allowedLogin.toLowerCase()) throw new HttpError(403, 'This GitHub account is not authorized for Vistory OS');

  response.setHeader('Set-Cookie', [
    clearCookie(oauthStateCookie, environment, 'Lax'),
    createSingleUserSessionCookie(login, environment),
  ]);
  redirect(response, configuration.appOrigin);
}

export function clearSingleUserSession(response: ServerResponse, environment: AuthEnvironment = process.env): void {
  response.setHeader('Set-Cookie', clearCookie(sessionCookieName(environment), environment, environment.NODE_ENV === 'production' ? 'None' : 'Lax'));
  response.statusCode = 204;
  response.end();
}

export function createSingleUserSessionCookie(login: string, environment: AuthEnvironment = process.env, now = Date.now()): string {
  const secret = environment.AUTH_SESSION_SECRET;
  const allowedLogin = environment.GITHUB_ALLOWED_LOGIN;
  if (!bounded(secret, 500, 32) || !validGitHubLogin(login) || !validGitHubLogin(allowedLogin) || login.toLowerCase() !== allowedLogin.toLowerCase()) {
    throw new HttpError(503, 'Single-user session configuration is invalid');
  }
  const payload: SessionPayload = { login, expiresAt: now + sessionDurationSeconds * 1_000 };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return cookieHeader(sessionCookieName(environment), `${encodedPayload}.${sign(encodedPayload, secret)}`, sessionDurationSeconds, environment, environment.NODE_ENV === 'production' ? 'None' : 'Lax');
}

function requireConfiguration(environment: AuthEnvironment) {
  const readiness = githubSingleUserAuthReadiness(environment);
  if (!readiness.ready) throw new HttpError(503, `GitHub single-user authentication is not configured: ${readiness.issues.join(', ')}`);
  return {
    clientId: environment.GITHUB_OAUTH_CLIENT_ID as string,
    clientSecret: environment.GITHUB_OAUTH_CLIENT_SECRET as string,
    allowedLogin: environment.GITHUB_ALLOWED_LOGIN as string,
    appOrigin: publicOrigin(environment.APP_PUBLIC_URL, environment.NODE_ENV === 'production') as string,
    apiOrigin: publicOrigin(environment.API_PUBLIC_URL, environment.NODE_ENV === 'production') as string,
  };
}

function publicOrigin(value: string | undefined, secure: boolean): string | null {
  if (!bounded(value, 2_048)) return null;
  try {
    const url = new URL(value);
    if (secure ? url.protocol !== 'https:' : !['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function validGitHubLogin(value: string | undefined): value is string {
  return Boolean(value && /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value));
}

function bounded(value: string | undefined, max: number, min = 1): value is string {
  return Boolean(value && value.length >= min && value.length <= max);
}

function sessionCookieName(environment: AuthEnvironment): string {
  return environment.NODE_ENV === 'production' ? productionSessionCookie : developmentSessionCookie;
}

function cookieHeader(name: string, value: string, maxAge: number, environment: AuthEnvironment, sameSite: 'Lax' | 'None'): string {
  const secure = environment.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly${secure}; SameSite=${sameSite}; Max-Age=${maxAge}`;
}

function clearCookie(name: string, environment: AuthEnvironment, sameSite: 'Lax' | 'None'): string {
  return cookieHeader(name, '', 0, environment, sameSite);
}

function cookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(header.split(';').map((part) => part.trim().split('=', 2)).filter((pair): pair is [string, string] => pair.length === 2 && Boolean(pair[0])));
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  return left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return validGitHubLogin(typeof payload.login === 'string' ? payload.login : undefined) && typeof payload.expiresAt === 'number' && Number.isSafeInteger(payload.expiresAt);
}

async function jsonRecord(response: Response): Promise<Record<string, unknown>> {
  const value = await response.json().catch(() => null) as unknown;
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function redirect(response: ServerResponse, location: string): void {
  response.statusCode = 302;
  response.setHeader('Location', location);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end();
}
