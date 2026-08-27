import type { IncomingMessage, ServerResponse } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { listAudit, verifyProjectAudit } from '../src/audit/audit';
import { beginGitHubLogin, clearSingleUserSession, completeGitHubLogin, readSingleUserSession } from '../src/auth/github-single-user';
import { decideApproval, listApprovals } from '../src/control/approvals';
import { dispatchRunTask, getDispatchContext, reportDispatchResult } from '../src/execution/task-execution';
import { authorizeCockpit, configureCors, HttpError, readJson, sendJson } from '../src/http';
import { clearSessionMemory, createFeedback, decideKnowledgeCandidate, listFeedback, listKnowledge, listKnowledgeCandidates, listSessionMemory, promoteKnowledgeCandidate, proposeKnowledgeCandidate, revokeKnowledgeEntry } from '../src/knowledge/knowledge';
import { serviceReadiness } from '../src/operations/readiness';
import { metricsSnapshot, observeHttpRequest } from '../src/operations/telemetry';
import { listProviderReadiness } from '../src/providers/providers';
import { commandRun, createSession, getRun, getSession, listBacklog, listProjects, listRuns, listSessions, planSession, startRun } from '../src/runs/runs';
import { publishTicketToGitHubIssue } from '../src/ticketing/github-issues';
import { assignTicket, findTicket, getWorkerContext, launchWorkflow, listTickets, saveSpecification, setTicketRisk, transitionTicket, validateSpecification } from '../src/tickets/tickets';

const prisma = new PrismaClient();

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  observeHttpRequest(request, response);
  try {
    if (configureCors(request, response)) return;

    const method = request.method ?? 'GET';
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (method === 'GET' && path === '/') {
      return sendJson(response, 200, { status: 'ok', service: 'software-factory-api', message: 'Software Factory API is running. Use /api/health for health checks.', health: '/api/health' });
    }

    if (method === 'GET' && path === '/api/health') {
      return sendJson(response, 200, { status: 'ok', service: 'software-factory-api', timestamp: new Date().toISOString() });
    }

    if (method === 'GET' && path === '/api/ready') {
      const readiness = await serviceReadiness(prisma);
      return sendJson(response, readiness.status === 'ready' ? 200 : 503, readiness);
    }

    if (method === 'GET' && path === '/api/metrics') return sendJson(response, 200, metricsSnapshot(headerValue(request.headers.authorization)));

    const authSession = readSingleUserSession(request);
    if (method === 'GET' && path === '/api/auth/session') {
      return sendJson(response, 200, authSession ? { authenticated: true, ...authSession } : { authenticated: false });
    }
    if (method === 'GET' && path === '/api/auth/github/start') return beginGitHubLogin(response);
    if (method === 'GET' && path === '/api/auth/github/callback') return completeGitHubLogin(request, response, url);
    if (method === 'POST' && path === '/api/auth/logout') {
      authorizeCockpit(request, authSession?.login);
      return clearSingleUserSession(response);
    }

    if (!path.startsWith('/api/worker/')) authorizeCockpit(request, authSession?.login);

    if (method === 'GET' && path === '/api/tickets') return sendJson(response, 200, await listTickets(prisma));
    if (method === 'GET' && path === '/api/audit') return sendJson(response, 200, await listAudit(prisma, requiredQuery(url, 'projectId')));
    if (method === 'GET' && path === '/api/audit/verify') return sendJson(response, 200, await verifyProjectAudit(prisma, requiredQuery(url, 'projectId')));
    if (method === 'GET' && path === '/api/approvals') return sendJson(response, 200, await listApprovals(prisma, requiredQuery(url, 'projectId')));
    if (method === 'GET' && path === '/api/projects') return sendJson(response, 200, await listProjects(prisma));
    if (method === 'GET' && path === '/api/providers') return sendJson(response, 200, await listProviderReadiness(prisma, requiredQuery(url, 'projectId')));
    if (method === 'GET' && path === '/api/feedback') return sendJson(response, 200, await listFeedback(prisma, requiredQuery(url, 'projectId'), url.searchParams.get('sessionId') ?? undefined));
    if (method === 'POST' && path === '/api/feedback') return sendJson(response, 201, await createFeedback(prisma, await readJsonWithAuthenticatedActor(request, authSession, 'authorId')));
    if (method === 'GET' && path === '/api/memory') return sendJson(response, 200, await listSessionMemory(prisma, requiredQuery(url, 'projectId'), requiredQuery(url, 'sessionId')));
    if (method === 'DELETE' && path === '/api/memory') return sendJson(response, 200, await clearSessionMemory(prisma, await readJsonWithAuthenticatedActor(request, authSession, 'actorId')));
    if (method === 'GET' && path === '/api/knowledge') return sendJson(response, 200, await listKnowledge(prisma, requiredQuery(url, 'projectId'), url.searchParams.get('q') ?? '', numericQuery(url, 'limit', 20)));
    if (method === 'GET' && path === '/api/knowledge/candidates') return sendJson(response, 200, await listKnowledgeCandidates(prisma, requiredQuery(url, 'projectId')));
    if (method === 'POST' && path === '/api/knowledge/candidates') return sendJson(response, 201, await proposeKnowledgeCandidate(prisma, await readJsonWithAuthenticatedActor(request, authSession, 'proposedBy')));
    if (method === 'POST' && path === '/api/sessions') return sendJson(response, 201, await createSession(prisma, await readJsonWithAuthenticatedActor(request, authSession, 'createdBy')));
    if (method === 'GET' && path === '/api/runs') return sendJson(response, 200, await listRuns(prisma, requiredQuery(url, 'projectId')));

    const projectSessionsMatch = path.match(/^\/api\/projects\/([^/]+)\/sessions$/);
    if (method === 'GET' && projectSessionsMatch) {
      return sendJson(response, 200, await listSessions(prisma, decodeURIComponent(projectSessionsMatch[1])));
    }

    const projectBacklogMatch = path.match(/^\/api\/projects\/([^/]+)\/backlog$/);
    if (method === 'GET' && projectBacklogMatch) {
      return sendJson(response, 200, await listBacklog(prisma, decodeURIComponent(projectBacklogMatch[1])));
    }

    const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)(?:\/([^/]+))?$/);
    if (sessionMatch) {
      const id = decodeURIComponent(sessionMatch[1]);
      const action = sessionMatch[2];
      if (method === 'GET' && !action) return sendJson(response, 200, await getSession(prisma, id, requiredQuery(url, 'projectId')));
      if (method === 'POST' && action === 'plan') return sendJson(response, 200, await planSession(prisma, id, await readJsonWithAuthenticatedActor(request, authSession, 'actorId')));
      if (method === 'POST' && action === 'runs') return sendJson(response, 201, await startRun(prisma, id, await readJsonWithAuthenticatedActor(request, authSession, 'actorId')));
    }

    const runTaskDispatchMatch = path.match(/^\/api\/runs\/([^/]+)\/tasks\/([^/]+)\/dispatch$/);
    if (method === 'POST' && runTaskDispatchMatch) {
      return sendJson(response, 200, await dispatchRunTask(
        prisma,
        decodeURIComponent(runTaskDispatchMatch[1]),
        decodeURIComponent(runTaskDispatchMatch[2]),
        await readJsonWithAuthenticatedActor(request, authSession, 'actorId'),
      ));
    }

    const runMatch = path.match(/^\/api\/runs\/([^/]+)(?:\/([^/]+))?$/);
    if (runMatch) {
      const id = decodeURIComponent(runMatch[1]);
      const action = runMatch[2];
      if (method === 'GET' && !action) return sendJson(response, 200, await getRun(prisma, id, requiredQuery(url, 'projectId')));
      if (method === 'POST' && action === 'commands') return sendJson(response, 200, await commandRun(prisma, id, await readJsonWithAuthenticatedActor(request, authSession, 'actorId')));
    }

    const approvalMatch = path.match(/^\/api\/approvals\/([^/]+)\/decisions$/);
    if (method === 'POST' && approvalMatch) {
      return sendJson(response, 200, await decideApproval(prisma, decodeURIComponent(approvalMatch[1]), await readJsonWithAuthenticatedActor(request, authSession, 'approverId')));
    }

    const knowledgeCandidateMatch = path.match(/^\/api\/knowledge\/candidates\/([^/]+)\/(decisions|promote)$/);
    if (method === 'POST' && knowledgeCandidateMatch) {
      const candidateId = decodeURIComponent(knowledgeCandidateMatch[1]);
      const action = knowledgeCandidateMatch[2];
      if (action === 'decisions') return sendJson(response, 200, await decideKnowledgeCandidate(prisma, candidateId, await readJsonWithAuthenticatedActor(request, authSession, 'approverId')));
      return sendJson(response, 200, await promoteKnowledgeCandidate(prisma, candidateId, await readJsonWithAuthenticatedActor(request, authSession, 'actorId')));
    }

    const knowledgeEntryMatch = path.match(/^\/api\/knowledge\/([^/]+)\/revoke$/);
    if (method === 'POST' && knowledgeEntryMatch) {
      return sendJson(response, 200, await revokeKnowledgeEntry(prisma, decodeURIComponent(knowledgeEntryMatch[1]), await readJsonWithAuthenticatedActor(request, authSession, 'actorId')));
    }

    const ticketMatch = path.match(/^\/api\/tickets\/([^/]+)(?:\/([^/]+))?$/);
    if (ticketMatch) {
      const id = decodeURIComponent(ticketMatch[1]);
      const action = ticketMatch[2];
      const actorId = authenticatedActorId(request, authSession);

      if (method === 'GET' && !action) return sendJson(response, 200, await findTicket(prisma, id));
      if (method === 'PATCH' && action === 'assign') return sendJson(response, 200, await assignTicket(prisma, id, await readJson(request)));
      if (method === 'PATCH' && action === 'risk') return sendJson(response, 200, await setTicketRisk(prisma, id, await readJson(request), actorId));
      if (method === 'PATCH' && action === 'status') return sendJson(response, 200, await transitionTicket(prisma, id, await readJson(request), actorId));
      if (method === 'PUT' && action === 'specification') return sendJson(response, 200, await saveSpecification(prisma, id, await readJson(request), actorId));
      if (method === 'POST' && action === 'validations') return sendJson(response, 200, await validateSpecification(prisma, id, await readJsonWithAuthenticatedActor(request, authSession, 'validatorId')));
      if (method === 'POST' && action === 'workflows') return sendJson(response, 200, await launchWorkflow(prisma, id, await readJsonWithAuthenticatedActor(request, authSession, 'actorId')));
      if (method === 'POST' && action === 'github-issue') return sendJson(response, 200, await publishTicketToGitHubIssue(prisma, id, actorId));
    }

    const workerMatch = path.match(/^\/api\/worker\/tickets\/([^/]+)\/context$/);
    if (method === 'GET' && workerMatch) {
      return sendJson(response, 200, await getWorkerContext(prisma, decodeURIComponent(workerMatch[1]), headerValue(request.headers.authorization)));
    }

    const dispatchWorkerMatch = path.match(/^\/api\/worker\/dispatches\/([^/]+)\/(context|results)$/);
    if (dispatchWorkerMatch) {
      const dispatchId = decodeURIComponent(dispatchWorkerMatch[1]);
      const action = dispatchWorkerMatch[2];
      const authorization = headerValue(request.headers.authorization);
      if (method === 'GET' && action === 'context') return sendJson(response, 200, await getDispatchContext(prisma, dispatchId, authorization));
      if (method === 'POST' && action === 'results') return sendJson(response, 200, await reportDispatchResult(prisma, dispatchId, await readJson(request), authorization));
    }

    return sendJson(response, 404, { message: `Cannot ${method} ${path}`, error: 'Not Found', statusCode: 404 });
  } catch (error) {
    if (error instanceof HttpError) return sendJson(response, error.statusCode, { message: error.message, error: error.name, statusCode: error.statusCode });
    console.error(error);
    return sendJson(response, 500, { message: 'Internal Server Error', error: 'Internal Server Error', statusCode: 500 });
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requiredQuery(url: URL, key: string): string {
  const value = url.searchParams.get(key);
  if (!value || value.length > 128) throw new HttpError(400, `${key} query parameter is required`);
  return value;
}

function numericQuery(url: URL, key: string, fallback: number): number {
  const value = url.searchParams.get(key);
  if (value === null) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number)) throw new HttpError(400, `${key} query parameter is invalid`);
  return number;
}

async function readJsonWithAuthenticatedActor(
  request: IncomingMessage,
  authSession: { login: string } | null,
  ...actorFields: string[]
): Promise<Record<string, unknown>> {
  const body = await readJson<Record<string, unknown>>(request);
  if (process.env.NODE_ENV !== 'production') return body;
  if (!authSession?.login) throw new HttpError(403, 'A human session is required for this operation');
  return Object.assign({}, body, Object.fromEntries(actorFields.map((field) => [field, authSession.login])));
}

function authenticatedActorId(request: IncomingMessage, authSession: { login: string } | null): string {
  if (process.env.NODE_ENV === 'production') {
    if (!authSession?.login) throw new HttpError(403, 'A human session is required for this operation');
    return authSession.login;
  }
  return headerValue(request.headers['x-actor-id']) ?? 'system';
}
