import { describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import handler from '../api';

describe('api http surface', () => {
  it('serves root and health without requiring a database', async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const server = createServer((request, response) => {
      void handler(request, response);
    });
    await listen(server);
    const baseUrl = getBaseUrl(server);

    try {
      const root = await fetch(`${baseUrl}/`);
      expect(root.status).toBe(200);
      expect(root.headers.get('x-content-type-options')).toBe('nosniff');
      expect(root.headers.get('x-frame-options')).toBe('DENY');
      expect(await root.json()).toMatchObject({ status: 'ok', service: 'vistory-api', health: '/api/health' });

      const health = await fetch(`${baseUrl}/api/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toMatchObject({ status: 'ok', service: 'vistory-api' });

      const tickets = await fetch(`${baseUrl}/api/tickets`);
      expect(tickets.status).toBe(503);
      expect(await tickets.json()).toMatchObject({ statusCode: 503 });
    } finally {
      server.close();
      if (previousDatabaseUrl) process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });
});

async function listen(server: any): Promise<void> {
  await new Promise<void>((resolve) => server.listen(0, resolve));
}

function getBaseUrl(server: any): string {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}
