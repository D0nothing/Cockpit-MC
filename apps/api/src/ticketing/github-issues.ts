import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { recordAudit } from '../audit/audit';
import { HttpError, requireDatabase } from '../http';
import { assertProviderReady } from '../providers/providers';

const provider = 'github-issues';
const inProgressWindowMs = 15_000;
const issuesPerPage = 50;
const reconciliationPages = 2;

const ticketSelect = {
  id: true,
  externalId: true,
  title: true,
  description: true,
  sourceUrl: true,
  labels: true,
  riskLevel: true,
  acceptanceCriteria: true,
  definitionOfDone: true,
  projectId: true,
  project: {
    select: {
      id: true,
      name: true,
      status: true,
      githubOwner: true,
      githubRepository: true,
      confluenceSpaceKey: true,
    },
  },
} satisfies Prisma.TicketSelect;

type GitHubIssueTicket = Prisma.TicketGetPayload<{ select: typeof ticketSelect }>;
type Environment = Readonly<Record<string, string | undefined>>;
type Fetcher = typeof fetch;

export interface GitHubIssueReceipt {
  ticketId: string;
  provider: typeof provider;
  state: 'succeeded';
  remoteId: string;
  remoteUrl: string;
  outcome: 'created' | 'reconciled' | 'updated' | 'already-linked';
}

export interface GitHubIssueDraftInput {
  id: string;
  externalId: number;
  title: string;
  description: string;
  labels: string[];
  riskLevel: string;
  acceptanceCriteria: string[];
  definitionOfDone: string[];
  project: { name: string };
}

interface GitHubIssueDraft {
  title: string;
  body: string;
  marker: string;
  payloadHash: string;
}

interface RemoteIssue {
  number: number;
  url: string;
}

export async function publishTicketToGitHubIssue(
  prisma: PrismaClient,
  ticketId: string,
  actorId: string,
  environment: Environment = process.env,
  fetcher: Fetcher = fetch,
): Promise<GitHubIssueReceipt> {
  requireDatabase();
  const actor = identifier(actorId, 'actorId');
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: ticketSelect });
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  if (ticket.project.status !== 'active') throw new HttpError(409, 'Ticket project is not active');

  const alreadyLinked = issueFromUrl(ticket.sourceUrl, ticket.project.githubOwner, ticket.project.githubRepository);
  if (ticket.sourceUrl && !alreadyLinked) throw new HttpError(409, 'Ticket already has another external source');
  const draft = buildGitHubIssueDraft(ticket);
  if (alreadyLinked) {
    const sync = await prisma.externalTicketSync.findUnique({ where: { ticketId_provider: { ticketId: ticket.id, provider } } });
    if (!sync || sync.payloadHash === draft.payloadHash) return receipt(ticket.id, alreadyLinked, 'already-linked');
    try {
      assertProviderReady(provider, ticket.project, environment);
      const token = environment.GITHUB_ISSUES_TOKEN;
      if (!bounded(token, 2_000, 20)) throw new HttpError(503, 'GitHub Issues connector is not configured');
      const remote = await updateRemoteIssue(ticket, alreadyLinked.number, draft, token, fetcher);
      await prisma.externalTicketSync.update({ where: { id: sync.id }, data: { state: 'succeeded', payloadHash: draft.payloadHash, remoteId: String(remote.number), remoteUrl: remote.url, failureCode: null, attempt: { increment: 1 }, requestedBy: actor } });
      await recordAudit(prisma, { projectId: ticket.projectId, actorId: actor, action: 'ticket.github_issue_updated', targetType: 'ticket', targetId: ticket.id, metadata: { provider, remoteId: String(remote.number), remoteUrl: remote.url, outcome: 'updated', payloadHash: draft.payloadHash } });
      return receipt(ticket.id, remote, 'updated');
    } catch (error) {
      const code = failureCode(error);
      await prisma.externalTicketSync.update({ where: { id: sync.id }, data: { state: 'failed', failureCode: code, attempt: { increment: 1 }, requestedBy: actor } }).catch(() => undefined);
      await auditFailure(prisma, ticket, actor, code, 'failed');
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'GitHub Issues connector failed');
    }
  }

  try {
    assertProviderReady(provider, ticket.project, environment);
  } catch (error) {
    await auditFailure(prisma, ticket, actor, failureCode(error), 'refused');
    throw error;
  }

  const token = environment.GITHUB_ISSUES_TOKEN;
  if (!bounded(token, 2_000, 20)) throw new HttpError(503, 'GitHub Issues connector is not configured');
  const claim = await claimSync(prisma, ticket, draft.payloadHash, actor);
  if (claim.receipt) return claim.receipt;

  try {
    const reconciled = claim.reconcile ? await findRemoteIssue(ticket, draft.marker, token, fetcher) : null;
    const remote = reconciled ?? await createRemoteIssue(ticket, draft, token, fetcher);
    const outcome = reconciled ? 'reconciled' : 'created';
    await prisma.$transaction([
      prisma.externalTicketSync.update({
        where: { id: claim.syncId },
        data: { state: 'succeeded', remoteId: String(remote.number), remoteUrl: remote.url, failureCode: null },
      }),
      prisma.ticket.update({ where: { id: ticket.id }, data: { sourceUrl: remote.url } }),
    ]);
    await recordAudit(prisma, {
      projectId: ticket.projectId,
      actorId: actor,
      action: 'ticket.github_issue_linked',
      targetType: 'ticket',
      targetId: ticket.id,
      metadata: { provider, remoteId: String(remote.number), remoteUrl: remote.url, outcome, payloadHash: draft.payloadHash },
    });
    return receipt(ticket.id, remote, outcome);
  } catch (error) {
    const code = failureCode(error);
    await prisma.externalTicketSync.update({ where: { id: claim.syncId }, data: { state: 'failed', failureCode: code } }).catch(() => undefined);
    await auditFailure(prisma, ticket, actor, code, 'failed');
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'GitHub Issues connector failed');
  }
}

export function buildGitHubIssueDraft(ticket: GitHubIssueDraftInput): GitHubIssueDraft {
  const title = clean(ticket.title, 200);
  const description = clean(ticket.description, 15_000);
  if (!title || !description) throw new HttpError(400, 'Ticket content is invalid');
  const marker = `<!-- vistory-ticket:${identifier(ticket.id, 'ticketId')} -->`;
  const criteria = markdownList(ticket.acceptanceCriteria, 'Aucun critère explicite.');
  const done = markdownList(ticket.definitionOfDone, 'La validation sera suivie dans Vistory OS.');
  const labels = ticket.labels.slice(0, 20).map((value) => clean(value, 100)).filter(Boolean).join(', ') || 'Aucun label';
  const body = [
    description,
    '## Critères d’acceptation',
    criteria,
    '## Definition of Done',
    done,
    '## Traçabilité Vistory OS',
    `- Ticket interne : #${ticket.externalId}`,
    `- Projet : ${clean(ticket.project.name, 200)}`,
    `- Risque : ${clean(ticket.riskLevel, 50)}`,
    `- Labels : ${labels}`,
    marker,
  ].join('\n\n');
  if (body.length > 50_000) throw new HttpError(400, 'Ticket content is too large for GitHub Issues');
  return { title, body, marker, payloadHash: createHash('sha256').update(JSON.stringify({ title, body })).digest('hex') };
}

async function claimSync(
  prisma: PrismaClient,
  ticket: GitHubIssueTicket,
  payloadHash: string,
  actorId: string,
): Promise<{ syncId: string; reconcile: boolean; receipt?: GitHubIssueReceipt }> {
  const existing = await prisma.externalTicketSync.findUnique({ where: { ticketId_provider: { ticketId: ticket.id, provider } } });
  if (existing?.state === 'succeeded' && existing.remoteId && existing.remoteUrl) {
    return { syncId: existing.id, reconcile: false, receipt: receipt(ticket.id, { number: positiveInteger(existing.remoteId, 'remoteId'), url: remoteUrl(existing.remoteUrl, ticket.project.githubOwner, ticket.project.githubRepository) }, 'already-linked') };
  }
  if (existing) {
    if (existing.state === 'pending' && Date.now() - existing.updatedAt.getTime() < inProgressWindowMs) {
      throw new HttpError(409, 'GitHub Issue synchronization is already in progress');
    }
    const claimed = await prisma.externalTicketSync.updateMany({
      where: { id: existing.id, state: existing.state, updatedAt: existing.updatedAt },
      data: { state: 'pending', payloadHash, requestedBy: actorId, failureCode: null, attempt: { increment: 1 } },
    });
    if (claimed.count !== 1) throw new HttpError(409, 'GitHub Issue synchronization is already in progress');
    return { syncId: existing.id, reconcile: true };
  }
  try {
    const created = await prisma.externalTicketSync.create({
      data: { projectId: ticket.projectId, ticketId: ticket.id, provider, payloadHash, requestedBy: actorId },
    });
    return { syncId: created.id, reconcile: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'GitHub Issue synchronization is already in progress');
    }
    throw error;
  }
}

async function findRemoteIssue(ticket: GitHubIssueTicket, marker: string, token: string, fetcher: Fetcher): Promise<RemoteIssue | null> {
  for (let page = 1; page <= reconciliationPages; page += 1) {
    const response = await githubRequest(ticket, token, fetcher, `/issues?state=all&sort=created&direction=desc&per_page=${issuesPerPage}&page=${page}`);
    const value = await boundedJson(response, 5_000_000);
    if (!Array.isArray(value)) throw new HttpError(503, 'GitHub Issues response is invalid');
    const found = value.map(remoteIssueRecord).find((issue) => issue?.body.includes(marker));
    if (found) return { number: found.number, url: issueUrl(ticket.project.githubOwner, ticket.project.githubRepository, found.number) };
    if (value.length < issuesPerPage) break;
  }
  return null;
}

async function createRemoteIssue(ticket: GitHubIssueTicket, draft: GitHubIssueDraft, token: string, fetcher: Fetcher): Promise<RemoteIssue> {
  const response = await githubRequest(ticket, token, fetcher, '/issues', { method: 'POST', body: JSON.stringify({ title: draft.title, body: draft.body }) });
  const value = await boundedJson(response, 1_000_000);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(503, 'GitHub Issues response is invalid');
  const number = positiveInteger((value as Record<string, unknown>).number, 'issue number');
  return { number, url: issueUrl(ticket.project.githubOwner, ticket.project.githubRepository, number) };
}

async function updateRemoteIssue(ticket: GitHubIssueTicket, number: number, draft: GitHubIssueDraft, token: string, fetcher: Fetcher): Promise<RemoteIssue> {
  const response = await githubRequest(ticket, token, fetcher, `/issues/${number}`, { method: 'PATCH', body: JSON.stringify({ title: draft.title, body: draft.body }) });
  const value = await boundedJson(response, 1_000_000);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(503, 'GitHub Issues response is invalid');
  return { number: positiveInteger((value as Record<string, unknown>).number, 'issue number'), url: issueUrl(ticket.project.githubOwner, ticket.project.githubRepository, number) };
}

async function githubRequest(
  ticket: GitHubIssueTicket,
  token: string,
  fetcher: Fetcher,
  suffix: string,
  init: { method?: 'POST' | 'PATCH'; body?: string } = {},
): Promise<Response> {
  const owner = githubSegment(ticket.project.githubOwner, 'owner');
  const repository = githubSegment(ticket.project.githubRepository, 'repository');
  let response: Response;
  try {
    response = await fetcher(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}${suffix}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Vistory-OS',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new HttpError(503, 'GitHub Issues connector is unavailable');
  }
  if (!response.ok) throw new HttpError(503, `GitHub Issues request failed (${response.status})`);
  return response;
}

async function boundedJson(response: Response, maxBytes: number): Promise<unknown> {
  if (!response.body) throw new HttpError(503, 'GitHub Issues response is empty');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(503, 'GitHub Issues response is too large');
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(503, 'GitHub Issues response is invalid');
  }
}

function remoteIssueRecord(value: unknown): { number: number; body: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if ('pull_request' in record || typeof record.body !== 'string') return null;
  try {
    return { number: positiveInteger(record.number, 'issue number'), body: record.body.slice(0, 100_000) };
  } catch {
    return null;
  }
}

function issueFromUrl(value: string | null, owner: string, repository: string): RemoteIssue | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const expectedPrefix = `/${githubSegment(owner, 'owner')}/${githubSegment(repository, 'repository')}/issues/`;
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !url.pathname.startsWith(expectedPrefix) || url.search || url.hash || url.username || url.password) return null;
    const suffix = url.pathname.slice(expectedPrefix.length);
    if (!/^\d+$/.test(suffix)) return null;
    const number = positiveInteger(suffix, 'issue number');
    return { number, url: issueUrl(owner, repository, number) };
  } catch {
    return null;
  }
}

function remoteUrl(value: string, owner: string, repository: string): string {
  const issue = issueFromUrl(value, owner, repository);
  if (!issue) throw new HttpError(409, 'Stored GitHub Issue URL is invalid');
  return issue.url;
}

function issueUrl(owner: string, repository: string, number: number): string {
  return `https://github.com/${githubSegment(owner, 'owner')}/${githubSegment(repository, 'repository')}/issues/${number}`;
}

function receipt(ticketId: string, issue: RemoteIssue, outcome: GitHubIssueReceipt['outcome']): GitHubIssueReceipt {
  return { ticketId, provider, state: 'succeeded', remoteId: String(issue.number), remoteUrl: issue.url, outcome };
}

async function auditFailure(prisma: PrismaClient, ticket: GitHubIssueTicket, actorId: string, code: string, state: 'refused' | 'failed'): Promise<void> {
  await recordAudit(prisma, {
    projectId: ticket.projectId,
    actorId,
    action: `ticket.github_issue_${state}`,
    targetType: 'ticket',
    targetId: ticket.id,
    metadata: { provider, failureCode: code },
  }).catch(() => undefined);
}

function failureCode(error: unknown): string {
  return error instanceof HttpError ? `http_${error.statusCode}` : 'unexpected';
}

function markdownList(values: string[], fallback: string): string {
  const items = values.slice(0, 20).map((value) => clean(value, 500)).filter(Boolean);
  return items.length === 0 ? fallback : items.map((value) => `- ${value}`).join('\n');
}

function clean(value: string, maxLength: number): string {
  return [...value].map((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('').trim().slice(0, maxLength);
}

function identifier(value: string, name: string): string {
  if (!/^[a-zA-Z0-9_.@-]{1,128}$/.test(value)) throw new HttpError(400, `${name} is invalid`);
  return value;
}

function githubSegment(value: string, name: string): string {
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(value)) throw new HttpError(503, `GitHub ${name} is invalid`);
  return value;
}

function positiveInteger(value: unknown, name: string): number {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1) throw new HttpError(503, `GitHub ${name} is invalid`);
  return number;
}

function bounded(value: string | undefined, max: number, min = 1): value is string {
  return Boolean(value && value.length >= min && value.length <= max);
}
