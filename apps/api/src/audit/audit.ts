import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { requireDatabase } from '../http';

export interface AuditInput {
  projectId?: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortDeep(item)]));
  }
  return value;
}

export function canonicalHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(sortDeep(value))).digest('hex');
}

export async function recordAudit(prisma: PrismaClient, input: AuditInput) {
  requireDatabase();
  return prisma.$transaction(async (tx) => {
    const previous = await tx.auditEvent.findFirst({ where: { projectId: input.projectId ?? null }, orderBy: { occurredAt: 'desc' } });
    const occurredAt = new Date();
    const metadata = input.metadata ?? {};
    const contentHash = canonicalHash(metadata);
    const integrityHash = canonicalHash({ ...input, metadata, occurredAt: occurredAt.toISOString(), contentHash, previousHash: previous?.integrityHash ?? null });
    return tx.auditEvent.create({ data: { ...input, metadata: metadata as Prisma.InputJsonValue, occurredAt, contentHash, previousHash: previous?.integrityHash, integrityHash } });
  });
}

export function listAudit(prisma: PrismaClient, projectId: string) {
  requireDatabase();
  return prisma.auditEvent.findMany({ where: { projectId }, orderBy: { occurredAt: 'desc' }, take: 100 });
}

export async function verifyProjectAudit(prisma: PrismaClient, projectId: string) {
  requireDatabase();
  const events = await prisma.auditEvent.findMany({ where: { projectId }, orderBy: { occurredAt: 'asc' }, take: 10_000 });
  let previousHash: string | null = null;
  for (const event of events) {
    if (event.previousHash !== previousHash || event.contentHash !== canonicalHash(event.metadata)) {
      return { valid: false, eventCount: events.length, failingEventId: event.id, head: previousHash };
    }
    const integrityHash = canonicalHash({
      projectId: event.projectId,
      actorId: event.actorId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      metadata: event.metadata,
      occurredAt: event.occurredAt.toISOString(),
      contentHash: event.contentHash,
      previousHash,
    });
    if (event.integrityHash !== integrityHash) return { valid: false, eventCount: events.length, failingEventId: event.id, head: previousHash };
    previousHash = event.integrityHash;
  }
  return { valid: true, eventCount: events.length, failingEventId: null, head: previousHash };
}
