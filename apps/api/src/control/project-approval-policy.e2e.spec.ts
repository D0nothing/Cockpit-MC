import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startLocalServer } from '../../api/dev';

const databaseDescribe = process.env.DATABASE_URL ? describe : describe.skip;

databaseDescribe('project-scoped SOLO_DEV approval E2E', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const admin = `admin-${suffix}`;
  const projectIds: string[] = [];
  let server: Server;
  let baseUrl = '';
  let previousAllowedLogin: string | undefined;

  beforeAll(async () => {
    previousAllowedLogin = process.env.GITHUB_ALLOWED_LOGIN;
    process.env.GITHUB_ALLOWED_LOGIN = admin;
    server = startLocalServer(0);
    await listen(server);
    baseUrl = getBaseUrl(server);
  });

  afterAll(async () => {
    await close(server);
    await prisma.auditEvent.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.$disconnect();
    if (previousAllowedLogin === undefined) delete process.env.GITHUB_ALLOWED_LOGIN;
    else process.env.GITHUB_ALLOWED_LOGIN = previousAllowedLogin;
  });

  it('isolates the exception, audits it, and keeps strict self-approval refused', async () => {
    const strict = await createApprovalFixture('strict');
    const solo = await createApprovalFixture('solo');

    const unauthorized = await rawRequest('PATCH', `/api/projects/${solo.projectId}/approval-policy`, {
      actorId: 'not-the-admin',
      approvalMode: 'SOLO_DEV',
      expectedVersion: 1,
      reason: 'Attempted privilege escalation.',
      confirmation: 'ENABLE SOLO_DEV',
    });
    expect(unauthorized.status).toBe(403);

    const activated = record(await request('PATCH', `/api/projects/${solo.projectId}/approval-policy`, {
      actorId: admin,
      approvalMode: 'SOLO_DEV',
      expectedVersion: 1,
      reason: 'Bounded single-user development pilot.',
      confirmation: 'ENABLE SOLO_DEV',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
    }));
    expect(activated.approvalMode).toBe('SOLO_DEV');
    expect(activated.effectiveApprovalMode).toBe('SOLO_DEV');
    expect(activated.approvalPolicyVersion).toBe(2);

    const strictDecision = await rawRequest('POST', `/api/approvals/${strict.approvalId}/decisions`, {
      projectId: strict.projectId,
      approverId: admin,
      result: 'approved',
      reason: 'Self approval must remain refused.',
      soloDevConfirmation: true,
    });
    expect(strictDecision.status).toBe(403);

    const soloDecision = record(await request('POST', `/api/approvals/${solo.approvalId}/decisions`, {
      projectId: solo.projectId,
      approverId: admin,
      result: 'approved',
      reason: 'Bounded development policy explicitly confirmed.',
      soloDevConfirmation: true,
    }));
    expect(soloDecision.status).toBe('approved');
    expect(record(soloDecision.session).state).toBe('ready');

    const strictApproval = await prisma.approvalRequest.findUniqueOrThrow({ where: { id: strict.approvalId } });
    expect(strictApproval.status).toBe('pending');
    const audit = await prisma.auditEvent.findMany({ where: { projectId: { in: [strict.projectId, solo.projectId] } } });
    expect(audit.some(({ projectId, action }) => projectId === solo.projectId && action === 'project.solo_dev_enabled')).toBe(true);
    expect(audit.some(({ projectId, action, metadata }) => projectId === solo.projectId && action === 'approval.approved' && record(metadata).selfDecision === true)).toBe(true);
    expect(audit.some(({ projectId, action }) => projectId === strict.projectId && action === 'approval.self_decision_refused')).toBe(true);
  }, 30_000);

  async function createApprovalFixture(label: string) {
    const project = await prisma.project.create({
      data: {
        name: `Approval ${label} ${suffix}`,
        slug: `approval-${label}-${suffix}`,
        legalEntityId: `entity-${label}-${suffix}`,
        memoryNamespace: `memory-${label}-${suffix}`,
        knowledgeNamespace: `knowledge-${label}-${suffix}`,
        githubOwner: 'example',
        githubRepository: `approval-${label}-${suffix}`,
      },
    });
    projectIds.push(project.id);
    const session = await prisma.workSession.create({
      data: {
        projectId: project.id,
        objective: `Verify ${label} project approval isolation.`,
        riskLevel: 'sensitive',
        state: 'awaiting_approval',
        createdBy: admin,
        idempotencyKey: `session-${label}-${suffix}`,
      },
    });
    const macroTask = await prisma.macroTask.create({
      data: {
        id: `macro-${label}-${suffix}`,
        projectId: project.id,
        sessionId: session.id,
        version: 1,
        objective: session.objective,
        expectedOutcome: 'A bounded, reviewed development proposal.',
        constraints: ['No production deployment'],
        nonGoals: ['No live provider call'],
        deliverables: ['Draft pull request'],
        acceptanceCriteria: ['Tests pass'],
        riskLevel: 'sensitive',
        requiredApprovals: 1,
        requiredCapabilities: ['verification'],
        budgets: { maxDurationMs: 300_000, maxCostCents: 0, maxContextTokens: 20_000, maxConcurrency: 1 },
      },
    });
    const approval = await prisma.approvalRequest.create({
      data: {
        projectId: project.id,
        sessionId: session.id,
        macroTaskId: macroTask.id,
        targetVersion: 1,
        riskLevel: 'sensitive',
        requiredApprovals: 1,
        requesterId: admin,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      },
    });
    return { projectId: project.id, approvalId: approval.id };
  }

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
