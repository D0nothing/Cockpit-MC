import {
  type SessionState,
  sessionStates,
  type TaskState,
  taskStates,
  type WorkerRunState,
  workerRunStates,
} from './domain';
import { ContractValidationError } from './validation';

export const sessionTransitions: Record<SessionState, readonly SessionState[]> = {
  created: ['planning', 'cancelled'],
  planning: ['awaiting_approval', 'ready', 'blocked', 'failed', 'cancelled'],
  awaiting_approval: ['ready', 'blocked', 'cancelled'],
  ready: ['running', 'cancelled'],
  running: ['review', 'blocked', 'failed', 'cancelled'],
  review: ['completed', 'running', 'failed', 'cancelled'],
  completed: [],
  blocked: ['planning', 'ready', 'cancelled'],
  failed: ['planning', 'cancelled'],
  cancelled: [],
};

export const taskTransitions: Record<TaskState, readonly TaskState[]> = {
  draft: ['blocked', 'ready', 'cancelled'],
  blocked: ['ready', 'cancelled'],
  ready: ['dispatched', 'blocked', 'cancelled'],
  dispatched: ['running', 'failed', 'cancelled'],
  running: ['review', 'failed', 'cancelled'],
  review: ['completed', 'ready', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export const workerRunTransitions: Record<WorkerRunState, readonly WorkerRunState[]> = {
  queued: ['awaiting_approval', 'running', 'cancelled'],
  awaiting_approval: ['queued', 'running', 'cancelled'],
  running: ['awaiting_approval', 'blocked', 'review', 'failed', 'cancelled'],
  blocked: ['queued', 'running', 'failed', 'cancelled'],
  review: ['running', 'completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransitionSession(from: SessionState, to: SessionState): boolean {
  return sessionTransitions[from].includes(to);
}

export function canTransitionTask(from: TaskState, to: TaskState): boolean {
  return taskTransitions[from].includes(to);
}

export function canTransitionWorkerRun(from: WorkerRunState, to: WorkerRunState): boolean {
  return workerRunTransitions[from].includes(to);
}

export type EventActorType = 'human' | 'service' | 'worker';

export interface EventEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  schemaVersion: 1;
  eventId: string;
  type: string;
  occurredAt: string;
  projectId: string;
  sessionId: string;
  correlationId: string;
  causationId?: string;
  runId?: string;
  taskId?: string;
  actor: { type: EventActorType; id: string };
  payload: TPayload;
}

export function parseEventEnvelope(value: unknown): EventEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ContractValidationError('EventEnvelope must be an object');
  const input = value as Record<string, unknown>;
  const actorInput = input.actor;
  const payload = input.payload;
  if (input.schemaVersion !== 1) throw new ContractValidationError('EventEnvelope.schemaVersion must be 1');
  if (!actorInput || typeof actorInput !== 'object' || Array.isArray(actorInput)) throw new ContractValidationError('EventEnvelope.actor must be an object');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ContractValidationError('EventEnvelope.payload must be an object');
  const actor = actorInput as Record<string, unknown>;
  const actorType = eventActorType(actor.type);
  return {
    schemaVersion: 1,
    eventId: eventIdentifier(input.eventId, 'eventId'),
    type: eventIdentifier(input.type, 'type'),
    occurredAt: eventDate(input.occurredAt, 'occurredAt'),
    projectId: eventIdentifier(input.projectId, 'projectId'),
    sessionId: eventIdentifier(input.sessionId, 'sessionId'),
    correlationId: eventIdentifier(input.correlationId, 'correlationId'),
    causationId: optionalEventIdentifier(input.causationId, 'causationId'),
    runId: optionalEventIdentifier(input.runId, 'runId'),
    taskId: optionalEventIdentifier(input.taskId, 'taskId'),
    actor: { type: actorType, id: eventIdentifier(actor.id, 'actor.id') },
    payload: payload as Record<string, unknown>,
  };
}

export function deduplicateEvents(events: readonly EventEnvelope[]): EventEnvelope[] {
  const unique = new Map<string, { event: EventEnvelope; canonical: string }>();
  for (const event of events) {
    const parsed = parseEventEnvelope(event);
    const canonical = stableJson(parsed);
    const previous = unique.get(parsed.eventId);
    if (previous && previous.canonical !== canonical) throw new ContractValidationError(`Conflicting replay for event ${parsed.eventId}`);
    if (!previous) unique.set(parsed.eventId, { event: parsed, canonical });
  }
  return [...unique.values()].map(({ event }) => event);
}

export function isEventSchemaCompatible(version: number): version is 1 {
  return version === 1;
}

export const domainStateSets = { sessionStates, taskStates, workerRunStates } as const;

function eventActorType(value: unknown): EventActorType {
  if (value !== 'human' && value !== 'service' && value !== 'worker') throw new ContractValidationError('EventEnvelope.actor.type is invalid');
  return value;
}

function eventIdentifier(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(value)) {
    throw new ContractValidationError(`EventEnvelope.${path} is invalid`);
  }
  return value;
}

function optionalEventIdentifier(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : eventIdentifier(value, path);
}

function eventDate(value: unknown, path: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new ContractValidationError(`EventEnvelope.${path} is invalid`);
  return value;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
