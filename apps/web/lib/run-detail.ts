import { parseTaskGraph, taskStates, workerRunStates, type RunReadModel } from '@software-factory/contracts';
import { apiRequest, array, choice, integer, object, string, strings } from './data';

export async function getRun(runId: string, projectId: string): Promise<RunReadModel> {
  return runReadModel(await apiRequest(`/runs/${encodeURIComponent(runId)}?projectId=${encodeURIComponent(projectId)}`));
}

function runReadModel(value: unknown): RunReadModel {
  const input = object(value, 'Run');
  const project = object(input.project, 'Run.project');
  const session = object(input.session, 'Run.session');
  const macroTask = object(input.macroTask, 'Run.macroTask');
  const graphInput = object(input.graph, 'Run.graph');
  const projectId = string(input.projectId, 'Run.projectId');
  const sessionId = string(input.sessionId, 'Run.sessionId');
  const graph = parseTaskGraph({
    schemaVersion: 1,
    projectId,
    sessionId,
    graphId: string(graphInput.id, 'Run.graph.id'),
    macroTaskId: string(macroTask.id, 'Run.macroTask.id'),
    macroTaskVersion: integer(macroTask.version, 'Run.macroTask.version'),
    nodes: graphInput.nodes,
  });
  return {
    id: string(input.id, 'Run.id'),
    projectId,
    sessionId,
    state: choice(input.state, 'Run.state', workerRunStates),
    storedState: choice(input.storedState, 'Run.storedState', workerRunStates),
    correlationId: string(input.correlationId, 'Run.correlationId'),
    createdAt: string(input.createdAt, 'Run.createdAt'),
    updatedAt: string(input.updatedAt, 'Run.updatedAt'),
    project: { id: string(project.id, 'Run.project.id'), name: string(project.name, 'Run.project.name'), slug: string(project.slug, 'Run.project.slug') },
    session: { id: string(session.id, 'Run.session.id'), objective: string(session.objective, 'Run.session.objective'), state: string(session.state, 'Run.session.state'), version: integer(session.version, 'Run.session.version') },
    macroTask: {
      id: string(macroTask.id, 'Run.macroTask.id'),
      version: integer(macroTask.version, 'Run.macroTask.version'),
      objective: string(macroTask.objective, 'Run.macroTask.objective'),
      expectedOutcome: string(macroTask.expectedOutcome, 'Run.macroTask.expectedOutcome'),
      acceptanceCriteria: strings(macroTask.acceptanceCriteria, 'Run.macroTask.acceptanceCriteria'),
      requiredCapabilities: strings(macroTask.requiredCapabilities, 'Run.macroTask.requiredCapabilities'),
    },
    graph: { id: graph.graphId, version: integer(graphInput.version, 'Run.graph.version'), nodes: graph.nodes },
    tasks: array(input.tasks, 'Run.tasks').map((taskValue) => {
      const task = object(taskValue, 'Run.task');
      const ticket = nullableObject(task.ticket, 'Run.task.ticket');
      return {
        id: string(task.id, 'Run.task.id'),
        taskId: string(task.taskId, 'Run.task.taskId'),
        capability: string(task.capability, 'Run.task.capability'),
        dependsOn: strings(task.dependsOn, 'Run.task.dependsOn'),
        state: choice(task.state, 'Run.task.state', taskStates),
        attempt: integer(task.attempt, 'Run.task.attempt'),
        ticket: ticket ? {
          id: string(ticket.id, 'Run.task.ticket.id'),
          externalId: integer(ticket.externalId, 'Run.task.ticket.externalId'),
          title: string(ticket.title, 'Run.task.ticket.title'),
          status: string(ticket.status, 'Run.task.ticket.status'),
          epic: ticket.epic ? (() => {
            const epic = object(ticket.epic, 'Run.task.ticket.epic');
            return { id: string(epic.id, 'Run.task.ticket.epic.id'), key: string(epic.key, 'Run.task.ticket.epic.key'), title: string(epic.title, 'Run.task.ticket.epic.title'), status: string(epic.status, 'Run.task.ticket.epic.status') };
          })() : null,
        } : null,
        dispatches: array(task.dispatches, 'Run.task.dispatches').map((dispatchValue) => {
          const dispatch = object(dispatchValue, 'Run.task.dispatch');
          return {
            id: string(dispatch.id, 'Run.task.dispatch.id'),
            provider: string(dispatch.provider, 'Run.task.dispatch.provider'),
            state: string(dispatch.state, 'Run.task.dispatch.state'),
            report: nullableString(dispatch.report, 'Run.task.dispatch.report'),
            error: nullableString(dispatch.error, 'Run.task.dispatch.error'),
            artifacts: array(dispatch.artifacts, 'Run.task.dispatch.artifacts').map(artifactSummary),
          };
        }),
      };
    }),
    events: array(input.events, 'Run.events').map((eventValue) => {
      const event = object(eventValue, 'Run.event');
      return {
        id: string(event.id, 'Run.event.id'),
        sequence: integer(event.sequence, 'Run.event.sequence'),
        type: string(event.type, 'Run.event.type'),
        actorType: string(event.actorType, 'Run.event.actorType'),
        actorId: string(event.actorId, 'Run.event.actorId'),
        occurredAt: string(event.occurredAt, 'Run.event.occurredAt'),
        payload: object(event.payload, 'Run.event.payload'),
      };
    }),
    artifacts: array(input.artifacts, 'Run.artifacts').map(artifactSummary),
  };
}

export async function dispatchRunTask(runId: string, taskId: string, projectId: string, provider: 'worker-simulator' | 'github-actions'): Promise<void> {
  await apiRequest(`/runs/${encodeURIComponent(runId)}/tasks/${encodeURIComponent(taskId)}/dispatch`, {
    method: 'POST',
    body: JSON.stringify({ projectId, actorId: 'user-alice', provider, idempotencyKey: `dispatch-${crypto.randomUUID()}` }),
  });
}

export async function createArtifactFeedback(input: { projectId: string; sessionId: string; runId: string; artifactId: string; kind: 'quality' | 'correction' | 'risk' | 'cost'; rating: -1 | 0 | 1; comment: string }): Promise<{ id: string }> {
  const value = object(await apiRequest('/feedback', { method: 'POST', body: JSON.stringify({ ...input, authorId: 'user-alice', idempotencyKey: `feedback-${crypto.randomUUID()}` }) }), 'Feedback');
  return { id: string(value.id, 'Feedback.id') };
}

function artifactSummary(value: unknown) {
  const artifact = object(value, 'Run.artifact');
  return {
    id: string(artifact.id, 'Run.artifact.id'),
    taskId: string(artifact.taskId, 'Run.artifact.taskId'),
    kind: string(artifact.kind, 'Run.artifact.kind'),
    uri: string(artifact.uri, 'Run.artifact.uri'),
    mediaType: string(artifact.mediaType, 'Run.artifact.mediaType'),
    contentHash: string(artifact.contentHash, 'Run.artifact.contentHash'),
  };
}

function nullableObject(value: unknown, path: string): Record<string, unknown> | null {
  return value === null || value === undefined ? null : object(value, path);
}

function nullableString(value: unknown, path: string): string | null {
  return value === null || value === undefined ? null : string(value, path);
}
