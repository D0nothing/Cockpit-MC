import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { performance } from 'node:perf_hooks';
import { HttpError } from '../http';

interface RouteMetrics {
  count: number;
  errors: number;
  durations: number[];
}

const routes = new Map<string, RouteMetrics>();
const maxSamples = 200;

export function observeHttpRequest(request: IncomingMessage, response: ServerResponse): void {
  const startedAt = performance.now();
  const method = request.method ?? 'GET';
  const route = routeTemplate(new URL(request.url ?? '/', 'http://localhost').pathname);
  const suppliedRequestId = request.headers['x-request-id'];
  const requestId = typeof suppliedRequestId === 'string' && /^[a-zA-Z0-9._-]{8,128}$/.test(suppliedRequestId) ? suppliedRequestId : randomUUID();
  response.setHeader('X-Request-Id', requestId);
  response.once('finish', () => {
    const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
    record(route, method, response.statusCode, durationMs);
    if (process.env.NODE_ENV !== 'test') console.info(JSON.stringify({ level: 'info', event: 'http.request', requestId, method, route, statusCode: response.statusCode, durationMs }));
  });
}

export function metricsSnapshot(authorization: string | undefined) {
  authorizeMetrics(authorization);
  return {
    generatedAt: new Date().toISOString(),
    routes: [...routes.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => {
      const durations = [...value.durations].sort((left, right) => left - right);
      return { key, count: value.count, errors: value.errors, p50Ms: percentile(durations, 0.5), p95Ms: percentile(durations, 0.95) };
    }),
  };
}

export function routeTemplate(path: string): string {
  if (/^\/api\/sessions\/[^/]+\/(plan|runs)$/.test(path)) return '/api/sessions/:id/:action';
  if (/^\/api\/sessions\/[^/]+$/.test(path)) return '/api/sessions/:id';
  if (/^\/api\/runs\/[^/]+\/tasks\/[^/]+\/dispatch$/.test(path)) return '/api/runs/:id/tasks/:taskId/dispatch';
  if (/^\/api\/runs\/[^/]+\/(advance|commands)$/.test(path)) return '/api/runs/:id/:action';
  if (/^\/api\/runs\/[^/]+$/.test(path)) return '/api/runs/:id';
  if (/^\/api\/worker\/dispatches\/[^/]+\/(context|results)$/.test(path)) return '/api/worker/dispatches/:id/:action';
  if (/^\/api\/knowledge\/candidates\/[^/]+\/(decisions|promote)$/.test(path)) return '/api/knowledge/candidates/:id/:action';
  if (/^\/api\/knowledge\/[^/]+\/revoke$/.test(path)) return '/api/knowledge/:id/revoke';
  if (/^\/api\/approvals\/[^/]+\/decisions$/.test(path)) return '/api/approvals/:id/decisions';
  if (/^\/api\/projects\/[^/]+\/sessions$/.test(path)) return '/api/projects/:id/sessions';
  if (/^\/api\/tickets\/[^/]+/.test(path)) return '/api/tickets/:id/:action';
  return ['/api/health', '/api/ready', '/api/metrics', '/api/projects', '/api/sessions', '/api/runs', '/api/approvals', '/api/audit', '/api/audit/verify', '/api/providers', '/api/feedback', '/api/memory', '/api/knowledge', '/api/knowledge/candidates'].includes(path) ? path : '/other';
}

function record(route: string, method: string, statusCode: number, durationMs: number): void {
  const key = `${method} ${route}`;
  const current = routes.get(key) ?? { count: 0, errors: 0, durations: [] };
  current.count += 1;
  if (statusCode >= 500) current.errors += 1;
  current.durations.push(durationMs);
  if (current.durations.length > maxSamples) current.durations.shift();
  routes.set(key, current);
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function authorizeMetrics(authorization: string | undefined): void {
  if (process.env.NODE_ENV !== 'production') return;
  const expected = process.env.METRICS_TOKEN;
  const received = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || expected.length < 32 || received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) throw new HttpError(401, 'Unauthorized');
}
