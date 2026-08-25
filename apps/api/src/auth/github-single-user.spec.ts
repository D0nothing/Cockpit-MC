import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { completeGitHubLogin, createSingleUserSessionCookie, githubSingleUserAuthReadiness, readSingleUserSession } from './github-single-user';

const environment = {
  NODE_ENV: 'production',
  GITHUB_OAUTH_CLIENT_ID: 'github-client-id',
  GITHUB_OAUTH_CLIENT_SECRET: 'github-client-secret-with-enough-length',
  GITHUB_ALLOWED_LOGIN: 'D0nothing',
  AUTH_SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
  APP_PUBLIC_URL: 'https://vistory.example',
  API_PUBLIC_URL: 'https://api.vistory.example',
};

afterEach(() => vi.restoreAllMocks());

describe('GitHub single-user authentication', () => {
  it('reports every missing production setting without exposing values', () => {
    expect(githubSingleUserAuthReadiness({ NODE_ENV: 'production' })).toEqual({
      ready: false,
      mode: 'github-single-user',
      issues: ['GITHUB_OAUTH_CLIENT_ID', 'GITHUB_OAUTH_CLIENT_SECRET', 'GITHUB_ALLOWED_LOGIN', 'AUTH_SESSION_SECRET', 'APP_PUBLIC_URL', 'API_PUBLIC_URL'],
    });
    expect(githubSingleUserAuthReadiness(environment)).toMatchObject({ ready: true, mode: 'github-single-user', issues: [] });
  });

  it('accepts only a signed, unexpired cookie for the configured login', () => {
    const now = Date.parse('2026-08-25T12:00:00.000Z');
    const cookie = createSingleUserSessionCookie('D0nothing', environment, now).split(';', 1)[0];
    expect(readSingleUserSession(request(cookie), environment, now)).toMatchObject({ login: 'D0nothing' });
    expect(readSingleUserSession(request(`${cookie}tampered`), environment, now)).toBeNull();
    expect(readSingleUserSession(request(cookie), { ...environment, GITHUB_ALLOWED_LOGIN: 'someone-else' }, now)).toBeNull();
    expect(readSingleUserSession(request(cookie), environment, now + 8 * 60 * 60 * 1_000 + 1)).toBeNull();
  });

  it('creates a session only for the allowlisted GitHub account', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'github-access-token-long-enough' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ login: 'D0nothing' }), { status: 200 }));
    const state = 'oauth-state-with-at-least-twenty-characters';
    const target = response();
    await completeGitHubLogin(request(`vistory_oauth_state=${state}`), target.value, new URL(`https://api.vistory.example/api/auth/github/callback?state=${state}&code=valid-code-value`), environment);
    expect(target.value.statusCode).toBe(302);
    expect(target.headers.get('Location')).toBe('https://vistory.example');
    expect(target.headers.get('Set-Cookie')).toEqual(expect.arrayContaining([expect.stringContaining('__Host-vistory_session=')]));
  });

  it('refuses a different GitHub account', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'github-access-token-long-enough' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ login: 'intruder' }), { status: 200 }));
    const state = 'oauth-state-with-at-least-twenty-characters';
    await expect(completeGitHubLogin(request(`vistory_oauth_state=${state}`), response().value, new URL(`https://api.vistory.example/api/auth/github/callback?state=${state}&code=valid-code-value`), environment)).rejects.toMatchObject({ statusCode: 403 });
  });
});

function request(cookie: string): IncomingMessage {
  return { headers: { cookie } } as IncomingMessage;
}

function response() {
  const headers = new Map<string, string | number | readonly string[]>();
  const value = {
    statusCode: 0,
    setHeader(name: string, headerValue: string | number | readonly string[]) { headers.set(name, headerValue); return value; },
    end() { return value; },
  } as unknown as ServerResponse;
  return { value, headers };
}
