import { createHash } from 'node:crypto';
import { Prisma, WorkflowMode, type PrismaClient } from '@prisma/client';
import { recordAudit } from '../audit/audit';
import { assertSoloDevelopmentBoundary, boundedSoloDevelopmentExecution } from './project-approval-policy';
import { HttpError, requireDatabase } from '../http';

type Fetcher = typeof fetch;

interface PullRequestEvidence {
  number: number;
  url: string;
  branchName: string;
  headCommitSha: string;
  workflowRuns: Array<{ name: string; conclusion: string }>;
}

export async function reconcileTicketWorkflow(prisma: PrismaClient, ticketId: string, body: unknown, fetcher: Fetcher = fetch) {
  requireDatabase();
  const input = bodyRecord(body);
  const projectId = bodyString(input, 'projectId', 128);
  const actorId = bodyString(input, 'actorId', 128);
  const pullRequestUrl = bodyString(input, 'pullRequestUrl', 2_048);
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, projectId },
    include: {
      project: true,
      workflow: true,
      sourceSession: { include: { approvalRequests: { orderBy: { createdAt: 'desc' }, take: 1 } } },
    },
  });
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  const approval = ticket.sourceSession?.approvalRequests[0];
  if (approval && approval.status !== 'approved') throw new HttpError(403, 'The source session must be approved before workflow reconciliation');

  const evidence = await fetchPullRequestEvidence(ticket.project.githubOwner, ticket.project.githubRepository, pullRequestUrl, fetcher);
  assertSoloDevelopmentBoundary(ticket.project, boundedSoloDevelopmentExecution(evidence.branchName));
  if (ticket.workflow?.pullRequestUrl && ticket.workflow.pullRequestUrl !== evidence.url) throw new HttpError(409, 'Ticket is already linked to another pull request');
  if (ticket.workflow?.branchName && ticket.workflow.branchName !== evidence.branchName) throw new HttpError(409, 'Ticket is already linked to another branch');
  if (ticket.workflow?.reconciledAt && ticket.workflow.headCommitSha === evidence.headCommitSha && ticket.workflow.ciStatus === 'success') {
    return prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { project: true, assignee: true, specification: true, validations: { include: { validator: true } }, workflow: true } });
  }

  const report = `Existing draft pull request #${evidence.number} reconciled after ${evidence.workflowRuns.length} successful pull request workflows.`;
  await prisma.$transaction(async (tx) => {
    await tx.workflowRun.upsert({
      where: { ticketId },
      create: {
        ticketId,
        mode: WorkflowMode.CODEX,
        branchName: evidence.branchName,
        pullRequestUrl: evidence.url,
        headCommitSha: evidence.headCommitSha,
        ciStatus: 'success',
        agentReport: report,
        reconciledAt: new Date(),
        reconciledBy: actorId,
      },
      update: {
        mode: WorkflowMode.CODEX,
        branchName: evidence.branchName,
        pullRequestUrl: evidence.url,
        headCommitSha: evidence.headCommitSha,
        ciStatus: 'success',
        agentReport: report,
        reconciledAt: new Date(),
        reconciledBy: actorId,
      },
    });
    await tx.ticket.update({ where: { id: ticketId }, data: { status: 'human_review_required' } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await recordAudit(prisma, {
    projectId,
    actorId,
    action: 'workflow.reconciled',
    targetType: 'ticket',
    targetId: ticketId,
    metadata: {
      pullRequestUrl: evidence.url,
      branchName: evidence.branchName,
      headCommitSha: evidence.headCommitSha,
      workflowRuns: evidence.workflowRuns,
      evidenceHash: createHash('sha256').update(JSON.stringify(evidence)).digest('hex'),
    },
  });
  return prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { project: true, assignee: true, specification: true, validations: { include: { validator: true } }, workflow: true } });
}

export async function fetchPullRequestEvidence(owner: string, repository: string, pullRequestUrl: string, fetcher: Fetcher = fetch): Promise<PullRequestEvidence> {
  const number = parsePullRequestUrl(owner, repository, pullRequestUrl);
  const token = process.env.GITHUB_TOKEN;
  if (!token || token.length < 20) throw new HttpError(503, 'GitHub read access is not configured for workflow reconciliation');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Vistory-OS', 'X-GitHub-Api-Version': '2022-11-28' };
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepository = encodeURIComponent(repository);
  const pullResponse = await fetcher(`https://api.github.com/repos/${encodedOwner}/${encodedRepository}/pulls/${number}`, { headers, signal: AbortSignal.timeout(8_000) });
  const pull = await jsonRecord(pullResponse);
  if (!pullResponse.ok) throw new HttpError(503, `GitHub pull request lookup failed (${pullResponse.status})`);
  const head = recordValue(pull.head);
  const headRepo = recordValue(head.repo);
  const branchName = stringValue(head.ref);
  const headCommitSha = stringValue(head.sha);
  if (pull.state !== 'open' || pull.draft !== true || stringValue(headRepo.full_name).toLowerCase() !== `${owner}/${repository}`.toLowerCase()) {
    throw new HttpError(409, 'Workflow reconciliation requires an open draft pull request in the configured repository');
  }
  if (!/^codex\/[A-Za-z0-9._/-]{1,90}$/.test(branchName) || branchName.includes('..') || branchName.includes('//') || !/^[a-f0-9]{40}$/i.test(headCommitSha)) {
    throw new HttpError(409, 'Pull request evidence is not a bounded codex/* proposal');
  }
  const workflowRunsUrl = `https://api.github.com/repos/${encodedOwner}/${encodedRepository}/actions/runs?event=pull_request&head_sha=${encodeURIComponent(headCommitSha)}&per_page=100`;
  const workflowRunsResponse = await fetcher(workflowRunsUrl, { headers, signal: AbortSignal.timeout(8_000) });
  const workflowRunsBody = await jsonRecord(workflowRunsResponse);
  if (!workflowRunsResponse.ok) throw new HttpError(503, `GitHub workflow run lookup failed (${workflowRunsResponse.status})`);
  const workflowRuns = Array.isArray(workflowRunsBody.workflow_runs) ? workflowRunsBody.workflow_runs.map((value) => {
    const run = recordValue(value);
    return {
      name: (stringValue(run.name) || stringValue(run.path)).slice(0, 200),
      status: stringValue(run.status),
      conclusion: stringValue(run.conclusion),
      event: stringValue(run.event),
      headCommitSha: stringValue(run.head_sha).toLowerCase(),
    };
  }).filter(({ event, headCommitSha: runHeadCommitSha }) => event === 'pull_request' && runHeadCommitSha === headCommitSha.toLowerCase()) : [];
  if (workflowRuns.length === 0 || workflowRuns.some(({ status, conclusion }) => status !== 'completed' || conclusion !== 'success')) {
    throw new HttpError(409, 'Every pull request workflow must be completed successfully before reconciliation');
  }
  return { number, url: `https://github.com/${owner}/${repository}/pull/${number}`, branchName, headCommitSha: headCommitSha.toLowerCase(), workflowRuns: workflowRuns.map(({ name, conclusion }) => ({ name, conclusion })) };
}

function parsePullRequestUrl(owner: string, repository: string, value: string): number {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, 'pullRequestUrl is invalid');
  }
  const expectedPrefix = `/${owner}/${repository}/pull/`.toLowerCase();
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.search || url.hash || !url.pathname.toLowerCase().startsWith(expectedPrefix)) {
    throw new HttpError(400, 'pullRequestUrl must target the configured GitHub repository');
  }
  const suffix = url.pathname.slice(expectedPrefix.length);
  if (!/^\d+$/.test(suffix)) throw new HttpError(400, 'pullRequestUrl is invalid');
  const number = Number(suffix);
  if (!Number.isSafeInteger(number) || number < 1) throw new HttpError(400, 'pullRequestUrl is invalid');
  return number;
}

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Request body must be an object');
  return value as Record<string, unknown>;
}

function bodyString(input: Record<string, unknown>, key: string, maxLength: number): string {
  const value = input[key];
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) throw new HttpError(400, `${key} is invalid`);
  return value.trim();
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function jsonRecord(response: Response): Promise<Record<string, unknown>> {
  return recordValue(await response.json().catch(() => null) as unknown);
}
