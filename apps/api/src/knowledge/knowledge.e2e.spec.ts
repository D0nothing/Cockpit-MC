import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startLocalServer } from '../../api/dev';

const databaseDescribe = process.env.DATABASE_URL ? describe : describe.skip;

databaseDescribe('request to governed knowledge E2E', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  let projectId = '';
  let otherProjectId = '';
  let server: Server;
  let baseUrl = '';

  beforeAll(async () => {
    const [project, otherProject] = await Promise.all([
      prisma.project.create({ data: { name: `E2E project ${suffix}`, slug: `e2e-${suffix}`, legalEntityId: `entity-${suffix}`, memoryNamespace: `memory-${suffix}`, knowledgeNamespace: `knowledge-${suffix}`, githubOwner: 'example', githubRepository: `e2e-${suffix}` } }),
      prisma.project.create({ data: { name: `E2E other ${suffix}`, slug: `e2e-other-${suffix}`, legalEntityId: `entity-other-${suffix}`, memoryNamespace: `memory-other-${suffix}`, knowledgeNamespace: `knowledge-other-${suffix}`, githubOwner: 'example', githubRepository: `e2e-other-${suffix}` } }),
    ]);
    projectId = project.id;
    otherProjectId = otherProject.id;
    server = startLocalServer(0);
    await listen(server);
    baseUrl = getBaseUrl(server);
  });

  afterAll(async () => {
    await close(server);
    await prisma.auditEvent.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
    await prisma.$disconnect();
  });

  it('plans tickets, dispatches with evidence, then promotes and revokes reviewed feedback', async () => {
    const session = record(await request('POST', '/api/sessions', { projectId, objective: 'Construire un portail web avec API, données et Knowledge Base gouvernée.', createdBy: 'requester', idempotencyKey: `session-${suffix}`, riskLevel: 'standard' }));
    const sessionId = text(session.id);
    const planned = record(await request('POST', `/api/sessions/${sessionId}/plan`, { projectId, actorId: 'requester' }));
    expect(list(planned.epics)).toHaveLength(3);
    expect(list(planned.epics).flatMap((epic) => list(record(epic).tickets)).length).toBeGreaterThanOrEqual(7);

    const run = record(await request('POST', `/api/sessions/${sessionId}/runs`, { projectId, actorId: 'requester', idempotencyKey: `run-${suffix}` }));
    const runId = text(run.id);
    const blocked = await rawRequest('POST', `/api/runs/${runId}/tasks/architecture/dispatch`, { projectId, actorId: 'requester', idempotencyKey: `blocked-${suffix}`, provider: 'worker-simulator' });
    expect(blocked.status).toBe(409);

    const dispatch = record(await request('POST', `/api/runs/${runId}/tasks/scope/dispatch`, { projectId, actorId: 'requester', idempotencyKey: `scope-${suffix}`, provider: 'worker-simulator' }));
    expect(dispatch.state).toBe('completed');
    const artifact = record(list(dispatch.artifacts)[0]);
    const artifactId = text(artifact.id);

    const crossProjectFeedback = await rawRequest('POST', '/api/feedback', { projectId: otherProjectId, sessionId, runId, artifactId, authorId: 'author', kind: 'quality', rating: 1, comment: 'This proof belongs to another project.', idempotencyKey: `cross-${suffix}` });
    expect(crossProjectFeedback.status).toBe(404);
    const feedback = record(await request('POST', '/api/feedback', { projectId, sessionId, runId, artifactId, authorId: 'author', kind: 'quality', rating: 1, comment: 'Persist evidence before unblocking dependent tickets.', idempotencyKey: `feedback-${suffix}` }));
    const feedbackId = text(feedback.id);
    expect(record(feedback.memoryItem).expiresAt).toBeTypeOf('string');
    expect(list(await request('GET', `/api/knowledge?projectId=${projectId}&q=${suffix}`))).toHaveLength(0);

    const candidate = record(await request('POST', '/api/knowledge/candidates', { projectId, feedbackId, proposedBy: 'author', scope: 'project', key: `orchestration.evidence-gate-${suffix}`, title: 'Evidence gate', content: `A dependent ticket stays blocked until every dependency has a persisted SHA-256 artifact. Evidence ${suffix}.` }));
    const candidateId = text(candidate.id);
    const selfApproval = await rawRequest('POST', `/api/knowledge/candidates/${candidateId}/decisions`, { projectId, approverId: 'author', result: 'approved', reason: 'Self approval must fail.' });
    expect(selfApproval.status).toBe(403);
    const approved = record(await request('POST', `/api/knowledge/candidates/${candidateId}/decisions`, { projectId, approverId: 'reviewer', result: 'approved', reason: 'Independent and bounded rule.' }));
    expect(approved.status).toBe('approved');
    const entry = record(await request('POST', `/api/knowledge/candidates/${candidateId}/promote`, { projectId, actorId: 'curator' }));
    const entryId = text(entry.id);
    expect(entry.version).toBe(1);

    const ownResults = list(await request('GET', `/api/knowledge?projectId=${projectId}&q=${suffix}`));
    expect(ownResults).toHaveLength(1);
    expect(text(record(ownResults[0]).citation)).toMatch(/^kb:.+@1$/);
    expect(list(await request('GET', `/api/knowledge?projectId=${otherProjectId}&q=${suffix}`))).toHaveLength(0);

    const revoked = record(await request('POST', `/api/knowledge/${entryId}/revoke`, { projectId, actorId: 'curator', reason: 'E2E revocation proof.' }));
    expect(revoked.status).toBe('revoked');
    expect(list(await request('GET', `/api/knowledge?projectId=${projectId}&q=${suffix}`))).toHaveLength(0);
    const history = list(await request('GET', `/api/knowledge/candidates?projectId=${projectId}`));
    expect(record(record(history[0]).entry).status).toBe('revoked');
  }, 30_000);

  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await rawRequest(method, path, body);
    expect(response.status, response.text).toBeGreaterThanOrEqual(200);
    expect(response.status, response.text).toBeLessThan(300);
    return JSON.parse(response.text) as unknown;
  }

  async function rawRequest(method: string, path: string, body?: unknown) {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, text: await response.text() };
  }
});

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as Record<string, unknown>;
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected array');
  return value;
}

function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected string');
  return value;
}

async function listen(server: Server): Promise<void> {
  if (server.listening) return;
  await new Promise<void>((resolve) => server.once('listening', resolve));
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function getBaseUrl(server: Server): string {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}
