import { Prisma, ProjectApprovalMode, type PrismaClient } from '@prisma/client';
import { recordAudit } from '../audit/audit';
import { HttpError, requireDatabase } from '../http';

const maximumSoloDevDurationMs = 30 * 24 * 60 * 60 * 1_000;

export interface ApprovalPolicyProject {
  approvalMode: ProjectApprovalMode;
  approvalPolicyVersion: number;
  soloDevExpiresAt: Date | null;
}

export interface DevelopmentExecutionBoundary {
  branchName: string;
  draftPullRequest: boolean;
  testsRequired: boolean;
  autoMerge: boolean;
  productionDeployment: boolean;
  liveSecrets: boolean;
  liveBilling: boolean;
  liveGeneration: boolean;
  livePrintBroker: boolean;
}

export const boundedSoloDevelopmentExecution = (branchName: string): DevelopmentExecutionBoundary => ({
  branchName,
  draftPullRequest: true,
  testsRequired: true,
  autoMerge: false,
  productionDeployment: false,
  liveSecrets: false,
  liveBilling: false,
  liveGeneration: false,
  livePrintBroker: false,
});

export function effectiveApprovalMode(project: ApprovalPolicyProject, now = new Date()): ProjectApprovalMode {
  if (project.approvalMode !== ProjectApprovalMode.SOLO_DEV) return ProjectApprovalMode.FOUR_EYES;
  return !project.soloDevExpiresAt || project.soloDevExpiresAt.getTime() > now.getTime()
    ? ProjectApprovalMode.SOLO_DEV
    : ProjectApprovalMode.FOUR_EYES;
}

export function assertSoloDevelopmentBoundary(project: ApprovalPolicyProject, boundary: DevelopmentExecutionBoundary, now = new Date()): void {
  if (effectiveApprovalMode(project, now) !== ProjectApprovalMode.SOLO_DEV) return;
  const invalid = !/^codex\/[A-Za-z0-9._/-]{1,90}$/.test(boundary.branchName)
    || boundary.branchName.includes('..')
    || boundary.branchName.includes('//')
    || !boundary.draftPullRequest
    || !boundary.testsRequired
    || boundary.autoMerge
    || boundary.productionDeployment
    || boundary.liveSecrets
    || boundary.liveBilling
    || boundary.liveGeneration
    || boundary.livePrintBroker;
  if (invalid) throw new HttpError(403, 'SOLO_DEV only permits tested development output on a codex/* branch and a draft pull request');
}

export function assertSoloSelfApproval(project: ApprovalPolicyProject, requiredApprovals: number, confirmed: boolean, now = new Date()): void {
  if (effectiveApprovalMode(project, now) !== ProjectApprovalMode.SOLO_DEV) {
    throw new HttpError(403, 'The requester cannot decide their own approval');
  }
  if (!confirmed) throw new HttpError(403, 'SOLO_DEV self-approval requires explicit confirmation');
  if (requiredApprovals !== 1) throw new HttpError(403, 'SOLO_DEV cannot replace a multi-party approval quorum');
}

export async function updateProjectApprovalPolicy(prisma: PrismaClient, projectId: string, body: unknown, environment: NodeJS.ProcessEnv = process.env) {
  requireDatabase();
  const input = bodyRecord(body);
  const actorId = bodyString(input, 'actorId', 128);
  const approvalMode = bodyChoice(input, 'approvalMode', [ProjectApprovalMode.FOUR_EYES, ProjectApprovalMode.SOLO_DEV] as const);
  const expectedVersion = bodyInteger(input, 'expectedVersion', 1);
  const reason = bodyString(input, 'reason', 500, 10);
  const confirmation = bodyString(input, 'confirmation', 32);
  const now = new Date();
  const soloDevExpiresAt = approvalMode === ProjectApprovalMode.SOLO_DEV ? optionalFutureDate(input, 'expiresAt', now) : null;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new HttpError(404, 'Project not found');

  if (!isConfiguredAdministrator(actorId, environment)) {
    await recordAudit(prisma, { projectId, actorId, action: 'project.approval_policy_change_refused', targetType: 'project', targetId: projectId, metadata: { requestedMode: approvalMode, reason: 'administrator_required' } });
    throw new HttpError(403, 'Only the configured administrator can change the project approval policy');
  }
  const expectedConfirmation = approvalMode === ProjectApprovalMode.SOLO_DEV ? 'ENABLE SOLO_DEV' : 'DISABLE SOLO_DEV';
  if (confirmation !== expectedConfirmation) throw new HttpError(400, `confirmation must be ${expectedConfirmation}`);
  if (project.approvalPolicyVersion !== expectedVersion) throw new HttpError(409, 'Approval policy was updated concurrently');

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.project.updateMany({
      where: { id: projectId, approvalPolicyVersion: expectedVersion },
      data: {
        approvalMode,
        soloDevExpiresAt,
        approvalPolicyReason: reason,
        approvalPolicyUpdatedAt: now,
        approvalPolicyUpdatedBy: actorId,
        approvalPolicyVersion: { increment: 1 },
        profileVersion: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new HttpError(409, 'Approval policy was updated concurrently');
    return tx.project.findUniqueOrThrow({ where: { id: projectId }, select: projectPolicySelect });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await recordAudit(prisma, {
    projectId,
    actorId,
    action: approvalMode === ProjectApprovalMode.SOLO_DEV ? 'project.solo_dev_enabled' : 'project.solo_dev_disabled',
    targetType: 'project',
    targetId: projectId,
    metadata: {
      fromMode: project.approvalMode,
      toMode: approvalMode,
      fromVersion: project.approvalPolicyVersion,
      toVersion: updated.approvalPolicyVersion,
      expiresAt: updated.soloDevExpiresAt?.toISOString() ?? null,
      reason,
    },
  });
  return projectApprovalPolicyReadModel(updated, now);
}

export const projectPolicySelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  profileVersion: true,
  githubOwner: true,
  githubRepository: true,
  approvalMode: true,
  approvalPolicyVersion: true,
  soloDevExpiresAt: true,
  approvalPolicyUpdatedAt: true,
  approvalPolicyUpdatedBy: true,
  approvalPolicyReason: true,
} as const;

export function projectApprovalPolicyReadModel<T extends ApprovalPolicyProject & {
  soloDevExpiresAt: Date | null;
  approvalPolicyUpdatedAt: Date | null;
}>(project: T, now = new Date()) {
  return {
    ...project,
    effectiveApprovalMode: effectiveApprovalMode(project, now),
    soloDevExpiresAt: project.soloDevExpiresAt?.toISOString() ?? null,
    approvalPolicyUpdatedAt: project.approvalPolicyUpdatedAt?.toISOString() ?? null,
  };
}

function isConfiguredAdministrator(actorId: string, environment: NodeJS.ProcessEnv): boolean {
  const configured = environment.GITHUB_ALLOWED_LOGIN?.trim()
    || (environment.NODE_ENV === 'production' ? '' : 'local-development');
  return Boolean(configured && actorId.toLowerCase() === configured.toLowerCase());
}

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Request body must be an object');
  return value as Record<string, unknown>;
}

function bodyString(input: Record<string, unknown>, key: string, maxLength: number, minLength = 1): string {
  const value = input[key];
  if (typeof value !== 'string' || value.trim().length < minLength || value.length > maxLength) throw new HttpError(400, `${key} is invalid`);
  return value.trim();
}

function bodyInteger(input: Record<string, unknown>, key: string, minimum: number): number {
  const value = input[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) throw new HttpError(400, `${key} is invalid`);
  return value;
}

function bodyChoice<const T extends readonly string[]>(input: Record<string, unknown>, key: string, allowed: T): T[number] {
  const value = input[key];
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) throw new HttpError(400, `${key} is invalid`);
  return value as T[number];
}

function optionalFutureDate(input: Record<string, unknown>, key: string, now: Date): Date | null {
  const value = input[key];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 50) throw new HttpError(400, `${key} is invalid`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= now.getTime() || date.getTime() - now.getTime() > maximumSoloDevDurationMs) {
    throw new HttpError(400, `${key} must be a future date within 30 days`);
  }
  return date;
}
