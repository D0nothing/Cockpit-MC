import { describe, expect, it } from 'vitest';
import {
  canTransitionSession,
  canTransitionTask,
  canTransitionWorkerRun,
  ContractValidationError,
  deduplicateEvents,
  isEventSchemaCompatible,
  parseEventEnvelope,
  sessionStates,
  taskStates,
  workerRunStates,
  type EventEnvelope,
  type SessionState,
  type TaskState,
  type WorkerRunState,
} from './index';

const expectedSessionTransitions: Record<SessionState, readonly SessionState[]> = {
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

const expectedTaskTransitions: Record<TaskState, readonly TaskState[]> = {
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

const expectedWorkerRunTransitions: Record<WorkerRunState, readonly WorkerRunState[]> = {
  queued: ['awaiting_approval', 'running', 'cancelled'],
  awaiting_approval: ['queued', 'running', 'cancelled'],
  running: ['awaiting_approval', 'blocked', 'review', 'failed', 'cancelled'],
  blocked: ['queued', 'running', 'failed', 'cancelled'],
  review: ['running', 'completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

describe('domain state machines', () => {
  it('checks every Session transition', () => assertTransitions(sessionStates, expectedSessionTransitions, canTransitionSession));
  it('checks every Task transition', () => assertTransitions(taskStates, expectedTaskTransitions, canTransitionTask));
  it('checks every WorkerRun transition', () => assertTransitions(workerRunStates, expectedWorkerRunTransitions, canTransitionWorkerRun));
});

describe('event protocol', () => {
  const event: EventEnvelope = {
    schemaVersion: 1,
    eventId: 'event-1',
    type: 'session.created',
    occurredAt: '2026-08-04T08:00:00.000Z',
    projectId: 'project-alpha',
    sessionId: 'session-1',
    correlationId: 'correlation-1',
    actor: { type: 'human', id: 'user-alice' },
    payload: { objective: 'Construire la tranche verticale.' },
  };

  it('validates the envelope and supported version', () => {
    expect(parseEventEnvelope(event)).toEqual(event);
    expect(isEventSchemaCompatible(1)).toBe(true);
    expect(isEventSchemaCompatible(2)).toBe(false);
  });

  it('deduplicates an event replay', () => {
    expect(deduplicateEvents([event, structuredClone(event)])).toEqual([event]);
  });

  it('rejects a conflicting replay', () => {
    expect(() => deduplicateEvents([event, { ...event, payload: { objective: 'Changed' } }])).toThrow(ContractValidationError);
  });
});

function assertTransitions<T extends string>(
  states: readonly T[],
  expected: Record<T, readonly T[]>,
  canTransition: (from: T, to: T) => boolean,
) {
  for (const from of states) {
    for (const to of states) expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected[from].includes(to));
  }
}
