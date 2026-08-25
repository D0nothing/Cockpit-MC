import { describe, expect, it } from 'vitest';
import { approvalRequirement, buildDeterministicPlan, deriveRunState, scheduleWaves } from './runs';

describe('deterministic coordinator', () => {
  it('builds a valid graph from input-specific epics and tickets', () => {
    const plan = buildDeterministicPlan({ projectId: 'project-alpha', sessionId: 'session-1', objective: 'Construire une application web avec API et données.' });
    expect(plan.requestPlan.epics).toHaveLength(3);
    expect(plan.graph.nodes.map(({ capability }) => capability)).toEqual(['product', 'architecture', 'frontend', 'backend', 'data', 'verification', 'product']);
    expect(plan.graph.nodes.find(({ taskId }) => taskId === 'verification')?.dependsOn).toEqual(['frontend', 'backend', 'data']);
  });

  it('requires distinct human approvals according to the risk matrix', () => {
    expect(approvalRequirement('standard')).toBe(0);
    expect(approvalRequirement('sensitive')).toBe(1);
    expect(approvalRequirement('critical')).toBe(2);
    expect(buildDeterministicPlan({
      projectId: 'project-alpha',
      sessionId: 'session-critical',
      objective: 'Modifier une frontière critique.',
      riskLevel: 'critical',
    }).macroTask.requiredApprovals).toBe(2);
  });
});

describe('bounded scheduler', () => {
  const tasks = [
    runTask('plan', []),
    runTask('backend', ['plan']),
    runTask('frontend', ['plan']),
    runTask('design', ['plan']),
    runTask('verify', ['backend', 'frontend', 'design']),
  ];

  it('respects dependencies and capacity', () => {
    const waves = scheduleWaves(tasks, 2);
    expect(waves.map((wave) => wave.map(({ taskId }) => taskId))).toEqual([
      ['plan'],
      ['backend', 'frontend'],
      ['design'],
      ['verify'],
    ]);
    expect(Math.max(...waves.map((wave) => wave.length))).toBe(2);
  });

  it('rejects a blocked graph', () => {
    expect(() => scheduleWaves([runTask('a', ['b']), runTask('b', ['a'])], 2)).toThrow('blocked or cyclic');
  });
});

describe('event read model', () => {
  it('derives the current run state from ordered events', () => {
    expect(deriveRunState([{ type: 'run.queued' }, { type: 'run.running' }, { type: 'run.review_required' }])).toBe('review');
  });
});

function runTask(taskId: string, dependsOn: string[]) {
  return { id: `id-${taskId}`, taskId, dependsOn, attempt: 1, expectedArtifacts: ['report'] };
}
