import {
  taskStates,
  workerRunStates,
  type ProjectSummary,
  type RunSummary,
  type TaskState,
  type TicketSummary,
  type WorkerRunState,
} from '@software-factory/contracts';

export type SessionRiskLevel = 'standard' | 'sensitive' | 'critical';

export type SessionLaunchResult =
  | { kind: 'approval'; sessionId: string }
  | { kind: 'run'; runId: string };

export interface ReadySessionSummary {
  id: string;
  projectId: string;
  objective: string;
  state: 'ready';
}

export const demoTickets: TicketSummary[] = [
  {
    id: 'demo-142',
    externalId: 142,
    title: 'Ajouter la rotation automatique des clés API',
    description: 'Renouvellement sans interruption des clés de service.',
    status: 'second_validation_required',
    riskLevel: 'critical',
    labels: ['security', 'backend'],
    repository: 'factory-demo',
    assignee: { id: 'alice', name: 'Alice Martin' },
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-139',
    externalId: 139,
    title: 'Optimiser le chargement du tableau de bord',
    description: 'Le premier affichage dépasse deux secondes.',
    status: 'spec_review_required',
    riskLevel: 'standard',
    labels: ['performance', 'frontend'],
    repository: 'factory-demo',
    assignee: { id: 'alice', name: 'Alice Martin' },
    updatedAt: new Date(Date.now() - 36e5).toISOString(),
  },
  {
    id: 'demo-137',
    externalId: 137,
    title: 'Synchroniser les commentaires GitHub',
    description: 'Importer les commentaires sans doublons.',
    status: 'assigned',
    riskLevel: 'standard',
    labels: ['github', 'integration'],
    repository: 'factory-demo',
    assignee: { id: 'marc', name: 'Marc Leroy' },
    updatedAt: new Date(Date.now() - 72e5).toISOString(),
  },
  {
    id: 'demo-128',
    externalId: 128,
    title: 'Améliorer les preuves de chaîne d’audit',
    description: 'Produire une racine Merkle vérifiable.',
    status: 'ci_running',
    riskLevel: 'sensitive',
    labels: ['audit', 'mainchain'],
    repository: 'factory-demo',
    assignee: { id: 'alice', name: 'Alice Martin' },
    updatedAt: new Date(Date.now() - 144e5).toISOString(),
  },
];

export function getApiUrl(path: string): string | null {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();

  if (!configuredUrl) {
    if (import.meta.env.PROD) return null;
    return `http://localhost:4000/api${path}`;
  }

  try {
    const baseUrl = new URL(configuredUrl);
    if (!['http:', 'https:'].includes(baseUrl.protocol)) return null;
    return new URL(`${baseUrl.pathname.replace(/\/$/, '')}${path}`, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function getTicket(id: string): Promise<any> {
  const fallback = demoTickets.find((ticket) => ticket.id === id) ?? demoTickets[0];
  const apiUrl = getApiUrl(`/tickets/${encodeURIComponent(id)}`);
  if (!apiUrl) return fallback;

  try {
    const response = await fetch(apiUrl, {
      cache: 'no-store',
      credentials: 'include',
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error();
    return await response.json();
  } catch {
    return fallback;
  }
}

function toTicketSummary(row: any): TicketSummary | null {
  if (!row || typeof row !== 'object') return null;
  if (typeof row.id !== 'string' || typeof row.externalId !== 'number' || typeof row.title !== 'string') return null;
  return {
    id: row.id,
    externalId: row.externalId,
    title: row.title,
    description: typeof row.description === 'string' ? row.description : '',
    status: row.status,
    riskLevel: row.riskLevel,
    labels: Array.isArray(row.labels) ? row.labels.filter((label: unknown): label is string => typeof label === 'string') : [],
    repository: typeof row.project?.githubRepository === 'string' ? row.project.githubRepository : 'unknown',
    assignee: row.assignee && typeof row.assignee.id === 'string' && typeof row.assignee.name === 'string' ? { id: row.assignee.id, name: row.assignee.name } : null,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString(),
  };
}

export async function getTickets(): Promise<TicketSummary[]> {
  const apiUrl = getApiUrl('/tickets');
  if (!apiUrl) return demoTickets;

  try {
    const response = await fetch(apiUrl, {
      cache: 'no-store',
      credentials: 'include',
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error();
    const rows = await response.json();
    if (!Array.isArray(rows)) return demoTickets;
    const tickets = rows.map(toTicketSummary).filter((ticket): ticket is TicketSummary => ticket !== null);
    return tickets.length > 0 ? tickets : demoTickets;
  } catch {
    return demoTickets;
  }
}

export async function getProjects(): Promise<ProjectSummary[]> {
  const value = await apiRequest('/projects');
  if (!Array.isArray(value)) throw new Error('Project list is invalid');
  return value.map(projectSummary);
}

export async function getRuns(projectId: string): Promise<RunSummary[]> {
  const value = await apiRequest(`/runs?projectId=${encodeURIComponent(projectId)}`);
  if (!Array.isArray(value)) throw new Error('Run list is invalid');
  return value.map(runSummary);
}

export async function getReadySessions(projectId: string): Promise<ReadySessionSummary[]> {
  const value = await apiRequest(`/projects/${encodeURIComponent(projectId)}/sessions`);
  if (!Array.isArray(value)) throw new Error('Session list is invalid');
  return value.map(sessionSummary).filter((session): session is ReadySessionSummary => session.state === 'ready');
}

export async function startSessionRun(projectId: string, sessionId: string): Promise<RunSummary> {
  const value = await apiRequest(`/sessions/${encodeURIComponent(sessionId)}/runs`, {
    method: 'POST',
    body: JSON.stringify({ projectId, actorId: 'user-alice', idempotencyKey: `run-${sessionId}` }),
  });
  return runSummary(value);
}

export async function launchSession(projectId: string, objective: string, riskLevel: SessionRiskLevel): Promise<SessionLaunchResult> {
  const requestId = crypto.randomUUID();
  const session = object(await apiRequest('/sessions', {
    method: 'POST',
    body: JSON.stringify({ projectId, objective, createdBy: 'user-alice', idempotencyKey: `session-${requestId}`, riskLevel }),
  }), 'Session');
  const sessionId = string(session.id, 'Session.id');
  const planned = object(await apiRequest(`/sessions/${encodeURIComponent(sessionId)}/plan`, {
    method: 'POST',
    body: JSON.stringify({ projectId, actorId: 'user-alice' }),
  }), 'Planned session');
  if (string(planned.state, 'Planned session.state') === 'awaiting_approval') return { kind: 'approval', sessionId };
  const run = object(await apiRequest(`/sessions/${encodeURIComponent(sessionId)}/runs`, {
    method: 'POST',
    body: JSON.stringify({ projectId, actorId: 'user-alice', idempotencyKey: `run-${requestId}` }),
  }), 'Run');
  const runId = string(run.id, 'Run.id');
  return { kind: 'run', runId };
}

export async function apiRequest(path: string, init?: RequestInit): Promise<unknown> {
  const apiUrl = getApiUrl(path);
  if (!apiUrl) throw new Error('API is not configured');
  const response = await fetch(apiUrl, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
    credentials: 'include',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as unknown;
    const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : `API request failed (${response.status})`;
    throw new Error(message);
  }
  return response.json() as Promise<unknown>;
}

function projectSummary(value: unknown): ProjectSummary {
  const input = object(value, 'Project');
  return {
    id: string(input.id, 'Project.id'),
    name: string(input.name, 'Project.name'),
    slug: string(input.slug, 'Project.slug'),
    status: choice(input.status, 'Project.status', ['active', 'suspended', 'archived']),
    profileVersion: integer(input.profileVersion, 'Project.profileVersion'),
    githubOwner: string(input.githubOwner, 'Project.githubOwner'),
    githubRepository: string(input.githubRepository, 'Project.githubRepository'),
  };
}

function runSummary(value: unknown): RunSummary {
  const input = object(value, 'Run');
  const session = object(input.session, 'Run.session');
  const tasks = array(input.tasks, 'Run.tasks').map((taskValue) => {
    const task = object(taskValue, 'Run.task');
    return { state: choice(task.state, 'Run.task.state', taskStates) as TaskState };
  });
  return {
    id: string(input.id, 'Run.id'),
    projectId: string(input.projectId, 'Run.projectId'),
    sessionId: string(input.sessionId, 'Run.sessionId'),
    state: choice(input.state, 'Run.state', workerRunStates) as WorkerRunState,
    correlationId: string(input.correlationId, 'Run.correlationId'),
    createdAt: string(input.createdAt, 'Run.createdAt'),
    updatedAt: string(input.updatedAt, 'Run.updatedAt'),
    session: { objective: string(session.objective, 'Run.session.objective') },
    tasks,
  };
}

function sessionSummary(value: unknown): ReadySessionSummary | { id: string; projectId: string; objective: string; state: string } {
  const input = object(value, 'Session');
  const state = string(input.state, 'Session.state');
  const summary = {
    id: string(input.id, 'Session.id'),
    projectId: string(input.projectId, 'Session.projectId'),
    objective: string(input.objective, 'Session.objective'),
    state,
  };
  return state === 'ready' ? { ...summary, state } : summary;
}

export function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} is invalid`);
  return value as Record<string, unknown>;
}

export function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} is invalid`);
  return value;
}

export function string(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new Error(`${path} is invalid`);
  return value;
}

export function strings(value: unknown, path: string): string[] {
  return array(value, path).map((item) => string(item, path));
}

export function integer(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`${path} is invalid`);
  return value;
}

export function choice<const T extends readonly string[]>(value: unknown, path: string, choices: T): T[number] {
  if (typeof value !== 'string' || !(choices as readonly string[]).includes(value)) throw new Error(`${path} is invalid`);
  return value as T[number];
}
