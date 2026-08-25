import { describe, expect, it } from 'vitest';
import {
  ContractValidationError,
  parseApprovalDecision,
  parseArtifact,
  parseFeedback,
  parseMacroTask,
  parseProjectContext,
  parseRoleProfile,
  parseSession,
  parseTaskGraph,
  parseToolGrant,
  parseWorkerRun,
} from './index';

const now = '2026-08-04T08:00:00.000Z';
const budget = { maxDurationMs: 60_000, maxCostCents: 500, maxContextTokens: 20_000, maxConcurrency: 2 };
const base = { schemaVersion: 1, projectId: 'project-alpha' };

const projectContext = {
  ...base,
  legalEntityId: 'entity-alpha',
  name: 'Projet Alpha',
  status: 'active',
  repositories: ['acme/alpha'],
  memoryNamespace: 'alpha-memory',
  knowledgeNamespace: 'alpha-kb',
  allowedSkills: [{ id: 'engineering', version: '1.0.0' }],
  allowedProviders: ['simulator'],
  dataClassification: 'internal',
  retentionDays: 90,
  rtoMinutes: 60,
  rpoMinutes: 15,
  budgets: budget,
};

const session = {
  ...base,
  sessionId: 'session-1',
  version: 1,
  state: 'created',
  objective: 'Construire une première tranche verticale durable.',
  createdBy: 'user-alice',
  createdAt: now,
  updatedAt: now,
};

const macroTask = {
  ...base,
  macroTaskId: 'macro-1',
  version: 1,
  sessionId: 'session-1',
  objective: 'Construire une première tranche verticale durable.',
  expectedOutcome: 'Un run supervisé et vérifiable.',
  constraints: ['Aucun effet externe'],
  nonGoals: ['Aucun fournisseur réel'],
  deliverables: ['API locale'],
  acceptanceCriteria: ['Le run atteint review'],
  riskLevel: 'standard',
  requiredApprovals: 0,
  requiredCapabilities: ['engineering'],
  budgets: budget,
};

const taskGraph = {
  ...base,
  graphId: 'graph-1',
  sessionId: 'session-1',
  macroTaskId: 'macro-1',
  macroTaskVersion: 1,
  nodes: [
    {
      taskId: 'task-plan',
      type: 'plan',
      capability: 'product',
      roleCapability: 'product',
      complexity: 'small',
      dependsOn: [],
      definitionOfReady: ['Objectif présent'],
      definitionOfDone: ['Plan validé'],
      maxAttempts: 1,
      expectedArtifacts: ['plan'],
    },
    {
      taskId: 'task-build',
      type: 'build',
      capability: 'engineering',
      roleCapability: 'engineering',
      complexity: 'medium',
      dependsOn: ['task-plan'],
      definitionOfReady: ['Plan validé'],
      definitionOfDone: ['Tests réussis'],
      maxAttempts: 2,
      expectedArtifacts: ['report'],
    },
  ],
};

const roleProfile = {
  ...base,
  roleId: 'engineering',
  version: '1.0.0',
  owner: 'agent-platform',
  mission: 'Produire un changement vérifiable.',
  acceptedTaskTypes: ['build'],
  skills: [{ id: 'typescript', version: '1.0.0' }],
  toolGrantIds: ['grant-repo-read'],
  forbiddenOutcomes: ['merge-default-branch'],
  requiredEvidence: ['tests'],
  budgets: budget,
};

const toolGrant = {
  ...base,
  grantId: 'grant-repo-read',
  roleId: 'engineering',
  connector: 'repository',
  operation: 'read',
  resourcePattern: 'acme/alpha/**',
  effect: 'read',
  dataClassifications: ['internal'],
  expiresAt: '2026-08-05T08:00:00.000Z',
};

const workerRun = {
  ...base,
  workerRunId: 'worker-run-1',
  runId: 'run-1',
  sessionId: 'session-1',
  taskId: 'task-build',
  roleId: 'engineering',
  attempt: 1,
  state: 'queued',
  createdAt: now,
};

const artifact = {
  ...base,
  artifactId: 'artifact-1',
  sessionId: 'session-1',
  runId: 'run-1',
  taskId: 'task-build',
  kind: 'report',
  uri: 'artifact://project-alpha/report-1',
  mediaType: 'text/markdown',
  contentHash: 'a'.repeat(64),
  createdAt: now,
};

const approval = {
  ...base,
  approvalId: 'approval-1',
  sessionId: 'session-1',
  runId: 'run-1',
  targetType: 'macro-task',
  targetId: 'macro-1',
  targetVersion: 1,
  requesterId: 'user-alice',
  approverId: 'user-marc',
  result: 'approved',
  reason: 'Critères complets.',
  decidedAt: now,
};

const feedback = {
  ...base,
  feedbackId: 'feedback-1',
  sessionId: 'session-1',
  runId: 'run-1',
  artifactId: 'artifact-1',
  authorId: 'user-alice',
  kind: 'quality',
  rating: 1,
  comment: 'Résultat conforme.',
  createdAt: now,
};

type ContractCase = { name: string; parse: (value: unknown) => unknown; value: Record<string, unknown> };
const contractCases: ContractCase[] = [
  { name: 'ProjectContext', parse: parseProjectContext, value: projectContext },
  { name: 'Session', parse: parseSession, value: session },
  { name: 'MacroTask', parse: parseMacroTask, value: macroTask },
  { name: 'TaskGraph', parse: parseTaskGraph, value: taskGraph },
  { name: 'RoleProfile', parse: parseRoleProfile, value: roleProfile },
  { name: 'ToolGrant', parse: parseToolGrant, value: toolGrant },
  { name: 'WorkerRun', parse: parseWorkerRun, value: workerRun },
  { name: 'Artifact', parse: parseArtifact, value: artifact },
  { name: 'ApprovalDecision', parse: parseApprovalDecision, value: approval },
  { name: 'Feedback', parse: parseFeedback, value: feedback },
];

describe('canonical domain contracts', () => {
  for (const contract of contractCases) {
    it(`accepts and sanitizes a valid ${contract.name}`, () => {
      expect(contract.parse({ ...contract.value, untrustedField: 'removed' })).not.toHaveProperty('untrustedField');
    });

    it(`rejects an invalid ${contract.name}`, () => {
      expect(() => contract.parse({ ...contract.value, projectId: '' })).toThrow(ContractValidationError);
    });
  }

  it('rejects a cyclic task graph', () => {
    const nodes = structuredClone(taskGraph.nodes);
    nodes[0].dependsOn = ['task-build'];
    expect(() => parseTaskGraph({ ...taskGraph, nodes })).toThrow('cycle');
  });

  it('rejects self approval', () => {
    expect(() => parseApprovalDecision({ ...approval, approverId: approval.requesterId })).toThrow('must differ');
  });
});
