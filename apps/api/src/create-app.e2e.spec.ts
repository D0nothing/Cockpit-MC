import { describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { startLocalServer } from '../api/dev';
import { createSingleUserSessionCookie } from './auth/github-single-user';

describe('api http surface', () => {
  it('serves root and health without requiring a database', async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const server = startLocalServer(0);
    await listen(server);
    const baseUrl = getBaseUrl(server);

    try {
      const root = await fetch(`${baseUrl}/`);
      expect(root.status).toBe(200);
      expect(root.headers.get('x-content-type-options')).toBe('nosniff');
      expect(root.headers.get('x-frame-options')).toBe('DENY');
      expect(await root.json()).toMatchObject({ status: 'ok', service: 'software-factory-api', health: '/api/health' });

      const health = await fetch(`${baseUrl}/api/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toMatchObject({ status: 'ok', service: 'software-factory-api' });

      const tickets = await fetch(`${baseUrl}/api/tickets`);
      expect(tickets.status).toBe(503);
      expect(await tickets.json()).toMatchObject({ statusCode: 503 });

      const legacyAdvance = await fetch(`${baseUrl}/api/runs/example/advance`, { method: 'POST' });
      expect(legacyAdvance.status).toBe(404);
      expect(await legacyAdvance.json()).toMatchObject({ statusCode: 404 });
    } finally {
      server.close();
      if (previousDatabaseUrl) process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it('requires an independent cockpit credential for business routes in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAccessToken = process.env.COCKPIT_ACCESS_TOKEN;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.NODE_ENV = 'production';
    process.env.COCKPIT_ACCESS_TOKEN = 'test-cockpit-access-token-32-characters';
    delete process.env.DATABASE_URL;
    const server = startLocalServer(0);
    await listen(server);
    const baseUrl = getBaseUrl(server);
    try {
      expect((await fetch(`${baseUrl}/api/projects`)).status).toBe(401);
      expect((await fetch(`${baseUrl}/api/projects`, { headers: { Authorization: `Bearer ${process.env.COCKPIT_ACCESS_TOKEN}` } })).status).toBe(503);
      const mutation = await fetch(`${baseUrl}/api/feedback`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.COCKPIT_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'project-alpha', authorId: 'spoofed-user' }),
      });
      expect(mutation.status).toBe(403);
      expect(await mutation.json()).toMatchObject({ message: 'A human session is required for this operation' });
    } finally {
      server.close();
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
      if (previousAccessToken === undefined) delete process.env.COCKPIT_ACCESS_TOKEN; else process.env.COCKPIT_ACCESS_TOKEN = previousAccessToken;
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it('accepts only the allowlisted GitHub session and rejects an unsafe mutation origin', async () => {
    const keys = ['NODE_ENV', 'DATABASE_URL', 'COCKPIT_ACCESS_TOKEN', 'WEB_ORIGIN', 'GITHUB_ALLOWED_LOGIN', 'AUTH_SESSION_SECRET'] as const;
    const previous = keys.map((key) => [key, process.env[key]] as const);
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    delete process.env.COCKPIT_ACCESS_TOKEN;
    process.env.WEB_ORIGIN = 'https://vistory.example';
    process.env.GITHUB_ALLOWED_LOGIN = 'D0nothing';
    process.env.AUTH_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
    const cookie = createSingleUserSessionCookie('D0nothing').split(';', 1)[0];
    const server = startLocalServer(0);
    await listen(server);
    const baseUrl = getBaseUrl(server);
    try {
      const session = await fetch(`${baseUrl}/api/auth/session`, { headers: { Cookie: cookie } });
      expect(session.status).toBe(200);
      expect(await session.json()).toMatchObject({ authenticated: true, login: 'D0nothing' });
      expect((await fetch(`${baseUrl}/api/projects`, { headers: { Cookie: cookie } })).status).toBe(503);
      expect((await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie } })).status).toBe(403);
      expect((await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie, Origin: 'https://vistory.example' } })).status).toBe(204);
    } finally {
      server.close();
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });
});

async function listen(server: Server): Promise<void> {
  if (server.listening) return;
  await new Promise<void>((resolve) => server.once('listening', resolve));
}

function getBaseUrl(server: Server): string {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}
