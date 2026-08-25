import { describe, expect, it } from 'vitest';
import { routeTemplate } from './telemetry';

describe('telemetry cardinality', () => {
  it('removes resource identifiers from metric keys', () => {
    expect(routeTemplate('/api/runs/run-secret/commands')).toBe('/api/runs/:id/:action');
    expect(routeTemplate('/api/runs/run-secret/tasks/task-secret/dispatch')).toBe('/api/runs/:id/tasks/:taskId/dispatch');
    expect(routeTemplate('/api/worker/dispatches/dispatch-secret/results')).toBe('/api/worker/dispatches/:id/:action');
    expect(routeTemplate('/api/knowledge/candidates/candidate-secret/promote')).toBe('/api/knowledge/candidates/:id/:action');
    expect(routeTemplate('/api/knowledge/entry-secret/revoke')).toBe('/api/knowledge/:id/revoke');
    expect(routeTemplate('/api/approvals/approval-secret/decisions')).toBe('/api/approvals/:id/decisions');
    expect(routeTemplate('/untrusted/value')).toBe('/other');
  });
});
