import { describe, expect, it } from 'vitest';
import { approvalRequirement, buildDeterministicPlan, deriveRunState, reconciledWorkflowTaskIds, scheduleWaves } from './runs';

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

  it('versions a revised macro task and graph without changing the task topology', () => {
    const first = buildDeterministicPlan({ projectId: 'project-alpha', sessionId: 'session-1', objective: 'Construire une application web avec API et données.' });
    const revised = buildDeterministicPlan({ projectId: 'project-alpha', sessionId: 'session-1', objective: 'Construire une application web avec API et données sur Ubuntu.', version: 2 });

    expect(revised.macroTask).toMatchObject({ macroTaskId: 'macro-session-1-v2', version: 2 });
    expect(revised.graph).toMatchObject({ graphId: 'graph-session-1-v2', macroTaskVersion: 2 });
    expect(revised.graph.nodes.map(({ taskId }) => taskId)).toEqual(first.graph.nodes.map(({ taskId }) => taskId));
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

describe('existing workflow reconciliation', () => {
  it('reuses only server-verified successful evidence and preserves dependencies', () => {
    const verified = { branchName: 'codex/ticket-1000', pullRequestUrl: 'https://github.com/example/repo/pull/1', headCommitSha: 'a'.repeat(40), ciStatus: 'success', reconciledAt: new Date() };
    const tickets = new Map([
      ['scope', { workflow: verified }],
      ['implementation', { workflow: { ...verified, pullRequestUrl: 'https://github.com/example/repo/pull/2' } }],
      ['unverified', { workflow: { ...verified, reconciledAt: null } }],
    ]);
    expect([...reconciledWorkflowTaskIds([
      { taskId: 'scope', dependsOn: [] },
      { taskId: 'implementation', dependsOn: ['scope'] },
      { taskId: 'unverified', dependsOn: [] },
    ], tickets)]).toEqual(['scope', 'implementation']);
  });
});

function runTask(taskId: string, dependsOn: string[]) {
  return { id: `id-${taskId}`, taskId, dependsOn, attempt: 1, expectedArtifacts: ['report'] };
}
