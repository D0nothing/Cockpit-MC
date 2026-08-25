import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { recordAudit } from '../audit/audit';
import { cleanPromptValue, HttpError, requireDatabase } from '../http';

const memoryTtlMs = 7 * 24 * 60 * 60 * 1_000;
const maxMemoryItemsPerSession = 100;
const maxSearchResults = 20;
const feedbackKinds = ['quality', 'correction', 'risk', 'cost'] as const;
const knowledgeScopes = ['project', 'common'] as const;

interface CandidateForDecision {
  proposedBy: string;
  feedbackAuthorId: string;
  status: string;
  expiresAt: Date;
}

export function candidateDecisionRefusal(candidate: CandidateForDecision, approverId: string, now = new Date()): 'self' | 'expired' | 'state' | null {
  if (approverId === candidate.proposedBy || approverId === candidate.feedbackAuthorId) return 'self';
  if (candidate.expiresAt.getTime() <= now.getTime()) return 'expired';
  return candidate.status === 'proposed' ? null : 'state';
}

export function requiredKnowledgeApprovals(scope: 'project' | 'common'): number {
  return scope === 'common' ? 2 : 1;
}

export async function createFeedback(prisma: PrismaClient, body: unknown) {
  requireDatabase();
  const input = bodyRecord(body);
  const projectId = bodyString(input, 'projectId', 128);
  const sessionId = bodyString(input, 'sessionId', 128);
  const runId = bodyString(input, 'runId', 128);
  const artifactId = bodyString(input, 'artifactId', 256);
  const authorId = bodyString(input, 'authorId', 128);
  const kind = bodyChoice(input, 'kind', feedbackKinds);
  const rating = bodyInteger(input, 'rating', -1, 1);
  if (![-1, 0, 1].includes(rating)) throw new HttpError(400, 'rating is invalid');
  const comment = bodyString(input, 'comment', 5_000);
  const idempotencyKey = bodyString(input, 'idempotencyKey', 128);
  const existing = await prisma.feedbackRecord.findUnique({
    where: { projectId_idempotencyKey: { projectId, idempotencyKey } },
    include: { memoryItem: true, candidate: true },
  });
  if (existing) {
    const matches = existing.sessionId === sessionId && existing.runId === runId && existing.artifactId === artifactId
      && existing.authorId === authorId && existing.kind === kind && existing.rating === rating && existing.comment === comment;
    if (!matches) throw new HttpError(409, 'Idempotency key already used with another feedback');
    return existing;
  }

  const artifact = await prisma.runArtifact.findFirst({
    where: { id: artifactId, projectId, sessionId, runId },
    select: { id: true, taskId: true, contentHash: true },
  });
  if (!artifact) throw new HttpError(404, 'Feedback proof not found in this project, session and run');
  const contentHash = createHash('sha256').update(`${artifact.contentHash}:${kind}:${rating}:${comment}`).digest('hex');
  const expiresAt = new Date(Date.now() + memoryTtlMs);
  const feedback = await prisma.$transaction(async (tx) => {
    await tx.sessionMemoryItem.deleteMany({ where: { projectId, sessionId, expiresAt: { lte: new Date() } } });
    const memoryCount = await tx.sessionMemoryItem.count({ where: { projectId, sessionId, expiresAt: { gt: new Date() } } });
    if (memoryCount >= maxMemoryItemsPerSession) throw new HttpError(429, 'Session memory quota exceeded');
    return tx.feedbackRecord.create({
      data: {
        projectId,
        sessionId,
        runId,
        artifactId,
        authorId,
        kind,
        rating,
        comment,
        idempotencyKey,
        memoryItem: { create: { projectId, sessionId, kind, content: comment, contentHash, expiresAt } },
      },
      include: { memoryItem: true, candidate: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await recordAudit(prisma, { projectId, actorId: authorId, action: 'feedback.created', targetType: 'feedback', targetId: feedback.id, metadata: { sessionId, runId, artifactId, taskId: artifact.taskId, kind, rating, contentHash } });
  return feedback;
}

export async function listFeedback(prisma: PrismaClient, projectId: string, sessionId?: string) {
  requireDatabase();
  return prisma.feedbackRecord.findMany({
    where: { projectId, ...(sessionId ? { sessionId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { memoryItem: true, candidate: { include: { decisions: { orderBy: { decidedAt: 'asc' } }, entry: true } } },
  });
}

export async function listSessionMemory(prisma: PrismaClient, projectId: string, sessionId: string) {
  requireDatabase();
  const session = await prisma.workSession.findFirst({ where: { id: sessionId, projectId }, select: { id: true } });
  if (!session) throw new HttpError(404, 'Session not found');
  await prisma.sessionMemoryItem.deleteMany({ where: { projectId, sessionId, expiresAt: { lte: new Date() } } });
  return prisma.sessionMemoryItem.findMany({ where: { projectId, sessionId }, orderBy: { createdAt: 'desc' }, take: maxMemoryItemsPerSession });
}

export async function clearSessionMemory(prisma: PrismaClient, body: unknown) {
  requireDatabase();
  const input = bodyRecord(body);
  const projectId = bodyString(input, 'projectId', 128);
  const sessionId = bodyString(input, 'sessionId', 128);
  const actorId = bodyString(input, 'actorId', 128);
  const session = await prisma.workSession.findFirst({ where: { id: sessionId, projectId }, select: { id: true } });
  if (!session) throw new HttpError(404, 'Session not found');
  const result = await prisma.sessionMemoryItem.deleteMany({ where: { projectId, sessionId } });
  await recordAudit(prisma, { projectId, actorId, action: 'memory.cleared', targetType: 'session', targetId: sessionId, metadata: { deletedItems: result.count } });
  return { projectId, sessionId, deletedItems: result.count };
}

export async function proposeKnowledgeCandidate(prisma: PrismaClient, body: unknown) {
  requireDatabase();
  const input = bodyRecord(body);
  const projectId = bodyString(input, 'projectId', 128);
  const feedbackId = bodyString(input, 'feedbackId', 128);
  const proposedBy = bodyString(input, 'proposedBy', 128);
  const scope = bodyChoice(input, 'scope', knowledgeScopes);
  const key = knowledgeKey(input.key);
  const title = bodyString(input, 'title', 300);
  const content = bodyString(input, 'content', 20_000);
  if (scope === 'common' && input.confirmCommonScope !== true) throw new HttpError(400, 'Common scope requires explicit confirmation');
  const contentHash = createHash('sha256').update(content).digest('hex');
  const existing = await prisma.knowledgeCandidate.findUnique({ where: { feedbackId }, include: candidateInclude });
  if (existing) {
    if (existing.projectId !== projectId || existing.proposedBy !== proposedBy || existing.scope !== scope || existing.key !== key || existing.contentHash !== contentHash) {
      throw new HttpError(409, 'Feedback already proposed with different knowledge');
    }
    return existing;
  }
  const feedback = await prisma.feedbackRecord.findFirst({ where: { id: feedbackId, projectId } });
  if (!feedback) throw new HttpError(404, 'Feedback not found');
  const provenance = {
    feedbackId,
    sessionId: feedback.sessionId,
    runId: feedback.runId,
    artifactId: feedback.artifactId,
    feedbackKind: feedback.kind,
    feedbackRating: feedback.rating,
  } satisfies Prisma.InputJsonObject;
  const candidate = await prisma.knowledgeCandidate.create({
    data: {
      projectId,
      feedbackId,
      proposedBy,
      scope,
      key,
      title,
      content,
      contentHash,
      provenance,
      requiredApprovals: requiredKnowledgeApprovals(scope),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
    },
    include: candidateInclude,
  });
  await recordAudit(prisma, { projectId, actorId: proposedBy, action: 'knowledge.candidate_proposed', targetType: 'knowledge_candidate', targetId: candidate.id, metadata: { feedbackId, scope, key, contentHash, requiredApprovals: candidate.requiredApprovals } });
  return candidate;
}

export function listKnowledgeCandidates(prisma: PrismaClient, projectId: string) {
  requireDatabase();
  return prisma.knowledgeCandidate.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 100, include: candidateInclude });
}

export async function decideKnowledgeCandidate(prisma: PrismaClient, candidateId: string, body: unknown) {
  requireDatabase();
  const input = bodyRecord(body);
  const projectId = bodyString(input, 'projectId', 128);
  const approverId = bodyString(input, 'approverId', 128);
  const result = bodyChoice(input, 'result', ['approved', 'rejected'] as const);
  const reason = bodyString(input, 'reason', 2_000);
  const candidate = await prisma.knowledgeCandidate.findFirst({ where: { id: candidateId, projectId }, include: candidateInclude });
  if (!candidate) throw new HttpError(404, 'Knowledge candidate not found');
  const refusal = candidateDecisionRefusal({ proposedBy: candidate.proposedBy, feedbackAuthorId: candidate.feedback.authorId, status: candidate.status, expiresAt: candidate.expiresAt }, approverId);
  if (refusal === 'self') throw new HttpError(403, 'Proposer and feedback author cannot approve their own candidate');
  if (refusal === 'expired') throw new HttpError(410, 'Knowledge candidate has expired');
  const existing = candidate.decisions.find((decision) => decision.approverId === approverId);
  if (existing) {
    if (existing.result !== result || existing.reason !== reason) throw new HttpError(409, 'Approver already decided differently');
    return candidate;
  }
  if (refusal === 'state') throw new HttpError(409, `Knowledge candidate cannot be decided from ${candidate.status}`);
  const approvedCount = candidate.decisions.filter((decision) => decision.result === 'approved').length + (result === 'approved' ? 1 : 0);
  const nextStatus = result === 'rejected' ? 'rejected' as const : approvedCount >= candidate.requiredApprovals ? 'approved' as const : 'proposed' as const;
  await prisma.$transaction([
    prisma.knowledgeDecision.create({ data: { projectId, candidateId, approverId, result, reason } }),
    prisma.knowledgeCandidate.update({ where: { id: candidateId }, data: { status: nextStatus } }),
  ]);
  await recordAudit(prisma, { projectId, actorId: approverId, action: `knowledge.candidate_${result}`, targetType: 'knowledge_candidate', targetId: candidateId, metadata: { nextStatus, approvedCount, requiredApprovals: candidate.requiredApprovals } });
  return getCandidate(prisma, candidateId, projectId);
}

export async function promoteKnowledgeCandidate(prisma: PrismaClient, candidateId: string, body: unknown) {
  requireDatabase();
  const input = bodyRecord(body);
  const projectId = bodyString(input, 'projectId', 128);
  const actorId = bodyString(input, 'actorId', 128);
  const candidate = await prisma.knowledgeCandidate.findFirst({
    where: { id: candidateId, projectId },
    include: { ...candidateInclude, project: { select: { knowledgeNamespace: true } } },
  });
  if (!candidate) throw new HttpError(404, 'Knowledge candidate not found');
  if (candidate.entry) return candidate.entry;
  if (candidate.expiresAt.getTime() <= Date.now()) throw new HttpError(410, 'Knowledge candidate has expired');
  const approvedCount = candidate.decisions.filter((decision) => decision.result === 'approved').length;
  if (candidate.status !== 'approved' || approvedCount < candidate.requiredApprovals) throw new HttpError(409, 'Knowledge candidate lacks the required human approvals');
  const namespace = candidate.scope === 'common' ? 'common' : candidate.project.knowledgeNamespace;
  if (!namespace || namespace === 'unconfigured') throw new HttpError(409, 'Project knowledge namespace is not configured');
  const promotedAt = new Date();
  const entry = await prisma.$transaction(async (tx) => {
    const latest = await tx.knowledgeEntry.findFirst({ where: { namespace, key: candidate.key }, orderBy: { version: 'desc' } });
    if (latest?.status === 'active') {
      await tx.knowledgeEntry.update({ where: { id: latest.id }, data: { status: 'revoked', revokedAt: promotedAt, revokedBy: actorId, revocationReason: `Superseded by candidate ${candidate.id}` } });
    }
    const created = await tx.knowledgeEntry.create({
      data: {
        projectId,
        candidateId,
        scope: candidate.scope,
        namespace,
        key: candidate.key,
        version: (latest?.version ?? 0) + 1,
        content: candidate.content,
        contentHash: candidate.contentHash,
        provenance: candidate.provenance as Prisma.InputJsonValue,
        supersedesId: latest?.id,
      },
    });
    await tx.knowledgeCandidate.update({ where: { id: candidate.id }, data: { status: 'promoted' } });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await recordAudit(prisma, { projectId, actorId, action: 'knowledge.promoted', targetType: 'knowledge_entry', targetId: entry.id, metadata: { candidateId, scope: entry.scope, namespace, key: entry.key, version: entry.version, contentHash: entry.contentHash } });
  return entry;
}

export async function listKnowledge(prisma: PrismaClient, projectId: string, query = '', requestedLimit = 20) {
  requireDatabase();
  const project = await prisma.project.findFirst({ where: { id: projectId, status: 'active' }, select: { id: true } });
  if (!project) throw new HttpError(404, 'Active project not found');
  if (query.length > 200) throw new HttpError(400, 'q is too long');
  const limit = Math.min(maxSearchResults, Math.max(1, Number.isInteger(requestedLimit) ? requestedLimit : 20));
  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      status: 'active',
      OR: [{ projectId, scope: 'project' }, { scope: 'common' }],
      ...(query ? { AND: [{ OR: [{ key: { contains: query, mode: 'insensitive' } }, { content: { contains: query, mode: 'insensitive' } }] }] } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: { candidate: { select: { title: true } } },
  });
  return entries.map((entry) => ({ ...entry, citation: `kb:${entry.id}@${entry.version}` }));
}

export async function activeKnowledgeContext(prisma: PrismaClient, projectId: string, maxEntries = 8, maxCharacters = 8_000) {
  const entries = await listKnowledge(prisma, projectId, '', Math.min(maxEntries, maxSearchResults));
  const context: Array<{ citation: string; key: string; content: string }> = [];
  let remaining = Math.max(0, Math.min(maxCharacters, 20_000));
  for (const entry of entries) {
    if (remaining === 0) break;
    const content = cleanPromptValue(entry.content).slice(0, remaining);
    context.push({ citation: entry.citation, key: entry.key, content });
    remaining -= content.length;
  }
  return context;
}

export async function revokeKnowledgeEntry(prisma: PrismaClient, entryId: string, body: unknown) {
  requireDatabase();
  const input = bodyRecord(body);
  const projectId = bodyString(input, 'projectId', 128);
  const actorId = bodyString(input, 'actorId', 128);
  const reason = bodyString(input, 'reason', 2_000);
  const entry = await prisma.knowledgeEntry.findFirst({ where: { id: entryId, projectId } });
  if (!entry) throw new HttpError(404, 'Knowledge entry not found');
  if (entry.status === 'revoked') return entry;
  const revoked = await prisma.knowledgeEntry.update({ where: { id: entryId }, data: { status: 'revoked', revokedAt: new Date(), revokedBy: actorId, revocationReason: reason } });
  await recordAudit(prisma, { projectId, actorId, action: 'knowledge.revoked', targetType: 'knowledge_entry', targetId: entryId, metadata: { namespace: entry.namespace, key: entry.key, version: entry.version, reason } });
  return revoked;
}

const candidateInclude = {
  feedback: { select: { id: true, sessionId: true, runId: true, artifactId: true, authorId: true, kind: true, rating: true, comment: true, createdAt: true } },
  decisions: { orderBy: { decidedAt: 'asc' as const } },
  entry: true,
} as const;

function getCandidate(prisma: PrismaClient, candidateId: string, projectId: string) {
  return prisma.knowledgeCandidate.findFirstOrThrow({ where: { id: candidateId, projectId }, include: candidateInclude });
}

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Request body must be an object');
  return value as Record<string, unknown>;
}

function bodyString(input: Record<string, unknown>, key: string, maxLength: number): string {
  const value = input[key];
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) throw new HttpError(400, `${key} is invalid`);
  return value;
}

function bodyInteger(input: Record<string, unknown>, key: string, minimum: number, maximum: number): number {
  const value = input[key];
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) throw new HttpError(400, `${key} is invalid`);
  return value as number;
}

function bodyChoice<const T extends readonly string[]>(input: Record<string, unknown>, key: string, allowed: T): T[number] {
  const value = input[key];
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) throw new HttpError(400, `${key} is invalid`);
  return value as T[number];
}

function knowledgeKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,99}$/.test(value)) throw new HttpError(400, 'key is invalid');
  return value;
}
