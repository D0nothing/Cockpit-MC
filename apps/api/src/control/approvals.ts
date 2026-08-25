import { Prisma, type PrismaClient } from '@prisma/client';
import { recordAudit } from '../audit/audit';
import { HttpError, requireDatabase } from '../http';

export function listApprovals(prisma: PrismaClient, projectId: string) {
  requireDatabase();
  return prisma.approvalRequest.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      project: { select: { id: true, name: true, slug: true } },
      session: { select: { id: true, objective: true, state: true } },
      macroTask: { select: { id: true, version: true, objective: true, acceptanceCriteria: true } },
      decisions: { orderBy: { decidedAt: 'asc' } },
    },
  });
}

export async function decideApproval(prisma: PrismaClient, approvalId: string, body: unknown) {
  requireDatabase();
  const input = bodyRecord(body);
  const projectId = bodyString(input, 'projectId', 128);
  const approverId = bodyString(input, 'approverId', 128);
  const result = bodyChoice(input, 'result', ['approved', 'rejected', 'changes_requested']);
  const reason = bodyString(input, 'reason', 2_000);
  const approval = await prisma.approvalRequest.findFirst({ where: { id: approvalId, projectId }, include: { decisions: true } });
  if (!approval) throw new HttpError(404, 'Approval request not found');
  if (approval.requesterId === approverId) {
    await recordAudit(prisma, { projectId, actorId: approverId, action: 'approval.self_decision_refused', targetType: 'approval', targetId: approvalId, metadata: { result } });
    throw new HttpError(403, 'The requester cannot decide their own approval');
  }
  if (approval.expiresAt.getTime() <= Date.now()) {
    await prisma.$transaction([
      prisma.approvalRequest.update({ where: { id: approvalId }, data: { status: 'expired' } }),
      prisma.workSession.update({ where: { id: approval.sessionId }, data: { state: 'blocked', version: { increment: 1 } } }),
    ]);
    await recordAudit(prisma, { projectId, actorId: approverId, action: 'approval.expired', targetType: 'approval', targetId: approvalId, metadata: {} });
    throw new HttpError(409, 'Approval request has expired');
  }
  const existing = approval.decisions.find((decision) => decision.approverId === approverId);
  if (existing) {
    if (existing.result !== result || existing.reason !== reason) throw new HttpError(409, 'Approver already decided differently');
    return getApproval(prisma, approvalId, projectId);
  }
  if (approval.status !== 'pending') throw new HttpError(409, `Approval request is already ${approval.status}`);

  const approvedCount = approval.decisions.filter((decision) => decision.result === 'approved').length + (result === 'approved' ? 1 : 0);
  const status = result === 'rejected' ? 'rejected' : result === 'changes_requested' ? 'changes_requested' : approvedCount >= approval.requiredApprovals ? 'approved' : 'pending';
  const sessionState = status === 'approved' ? 'ready' : status === 'pending' ? 'awaiting_approval' : status === 'changes_requested' ? 'planning' : 'blocked';

  await prisma.$transaction(async (tx) => {
    await tx.approvalRecord.create({ data: { projectId, approvalRequestId: approvalId, approverId, result, reason } });
    await tx.approvalRequest.update({ where: { id: approvalId }, data: { status } });
    await tx.workSession.update({ where: { id: approval.sessionId }, data: { state: sessionState, version: { increment: 1 } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await recordAudit(prisma, {
    projectId,
    actorId: approverId,
    action: `approval.${result}`,
    targetType: 'approval',
    targetId: approvalId,
    metadata: { status, approvedCount, requiredApprovals: approval.requiredApprovals },
  });
  return getApproval(prisma, approvalId, projectId);
}

async function getApproval(prisma: PrismaClient, approvalId: string, projectId: string) {
  const approval = await prisma.approvalRequest.findFirst({
    where: { id: approvalId, projectId },
    include: {
      project: { select: { id: true, name: true, slug: true } },
      session: { select: { id: true, objective: true, state: true } },
      macroTask: { select: { id: true, version: true, objective: true, acceptanceCriteria: true } },
      decisions: { orderBy: { decidedAt: 'asc' } },
    },
  });
  if (!approval) throw new HttpError(404, 'Approval request not found');
  return approval;
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

function bodyChoice<const T extends readonly string[]>(input: Record<string, unknown>, key: string, allowed: T): T[number] {
  const value = input[key];
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) throw new HttpError(400, `${key} is invalid`);
  return value as T[number];
}
