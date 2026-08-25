import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

export type Handler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.end(JSON.stringify(body));
}

export function configureCors(request: IncomingMessage, response: ServerResponse): boolean {
  const origin = request.headers.origin;
  const allowedOrigins = webOrigins();

  if (origin && (allowedOrigins.length === 0 ? process.env.NODE_ENV !== 'production' : allowedOrigins.includes(origin))) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Actor-Id,X-Request-Id');
  response.setHeader('Access-Control-Max-Age', '600');

  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return true;
  }

  return false;
}

export async function readJson<T>(request: IncomingMessage, maxBytes = 64_000): Promise<T> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) throw new HttpError(413, 'Payload too large');
    chunks.push(buffer);
  }

  if (chunks.length === 0) return {} as T;

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON payload');
  }
}

export function requireDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new HttpError(503, 'Database is not configured. Set DATABASE_URL before using business routes.');
  }
}

export function authorizeCockpit(request: IncomingMessage, sessionLogin?: string): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (sessionLogin) {
    if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
      const origin = request.headers.origin;
      if (!origin || !webOrigins().includes(origin)) throw new HttpError(403, 'Request origin is not authorized');
    }
    return;
  }
  const expected = process.env.COCKPIT_ACCESS_TOKEN;
  const authorization = Array.isArray(request.headers.authorization) ? request.headers.authorization[0] : request.headers.authorization;
  const received = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || expected.length < 32 || received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
    throw new HttpError(401, 'Unauthorized');
  }
}

function webOrigins(): string[] {
  return (process.env.WEB_ORIGIN ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function cleanPromptValue(value: string): string {
  return [...value]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 ? ' ' : char;
    })
    .join('')
    .slice(0, 50_000);
}
