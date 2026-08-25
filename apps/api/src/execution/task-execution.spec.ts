import { describe, expect, it } from 'vitest';
import { dispatchRefusalReason } from './task-execution';

describe('governed task dispatch', () => {
  it('refuses a task while a dependency is incomplete', () => {
    const tasks = [
      task('scope', 'ready'),
      task('implementation', 'ready', ['scope']),
    ];

    expect(dispatchRefusalReason(tasks, 'implementation')).toBe('dependencies');
  });

  it('accepts only the latest ready attempt after dependencies complete', () => {
    const tasks = [
      task('scope', 'completed'),
      task('implementation', 'failed', ['scope'], 1),
      task('implementation', 'ready', ['scope'], 2),
    ];

    expect(dispatchRefusalReason(tasks, 'implementation')).toBeNull();
  });

  it('refuses missing and non-ready tasks', () => {
    expect(dispatchRefusalReason([task('scope', 'blocked')], 'scope')).toBe('state');
    expect(dispatchRefusalReason([task('scope', 'ready')], 'unknown')).toBe('missing');
  });
});

function task(taskId: string, state: string, dependsOn: string[] = [], attempt = 1) {
  return { taskId, state, dependsOn, attempt };
}
