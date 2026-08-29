export const contractSchemaVersion = 1 as const;
export type ContractSchemaVersion = typeof contractSchemaVersion;

export type ProjectStatus = 'active' | 'suspended' | 'archived';
export type ProjectApprovalMode = 'FOUR_EYES' | 'SOLO_DEV';
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';
export type DomainRiskLevel = 'standard' | 'sensitive' | 'critical';

export interface ExecutionBudget {
  maxDurationMs: number;
  maxCostCents: number;
  maxContextTokens: number;
  maxConcurrency: number;
}

export interface VersionedReference {
  id: string;
  version: string;
}

interface ProjectScopedContract {
  schemaVersion: ContractSchemaVersion;
  projectId: string;
}

export interface ProjectContext extends ProjectScopedContract {
  legalEntityId: string;
  name: string;
  status: ProjectStatus;
  repositories: string[];
  memoryNamespace: string;
  knowledgeNamespace: string;
  allowedSkills: VersionedReference[];
  allowedProviders: string[];
  dataClassification: DataClassification;
  retentionDays: number;
  rtoMinutes: number;
  rpoMinutes: number;
  budgets: ExecutionBudget;
}

export const sessionStates = [
  'created',
  'planning',
  'awaiting_approval',
  'ready',
  'running',
  'review',
  'completed',
  'blocked',
  'failed',
  'cancelled',
] as const;
export type SessionState = (typeof sessionStates)[number];

export interface Session extends ProjectScopedContract {
  sessionId: string;
  version: number;
  state: SessionState;
  objective: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MacroTask extends ProjectScopedContract {
  macroTaskId: string;
  version: number;
  sessionId: string;
  objective: string;
  expectedOutcome: string;
  constraints: string[];
  nonGoals: string[];
  deliverables: string[];
  acceptanceCriteria: string[];
  riskLevel: DomainRiskLevel;
  requiredApprovals: number;
  requiredCapabilities: string[];
  budgets: ExecutionBudget;
}

export type PlannedTicketKind = 'discovery' | 'architecture' | 'implementation' | 'verification' | 'delivery';

export interface EpicPlan {
  epicKey: string;
  title: string;
  objective: string;
  expectedOutcome: string;
  acceptanceCriteria: string[];
  ticketKeys: string[];
}

export interface DeliveryTicketPlan {
  ticketKey: string;
  epicKey: string;
  title: string;
  description: string;
  kind: PlannedTicketKind;
  capability: string;
  complexity: TaskComplexity;
  dependsOn: string[];
  acceptanceCriteria: string[];
  definitionOfDone: string[];
  expectedArtifacts: string[];
}

export interface RequestPlan extends ProjectScopedContract {
  sessionId: string;
  objectiveHash: string;
  epics: EpicPlan[];
  tickets: DeliveryTicketPlan[];
}

export const taskStates = [
  'draft',
  'blocked',
  'ready',
  'dispatched',
  'running',
  'review',
  'completed',
  'failed',
  'cancelled',
] as const;
export type TaskState = (typeof taskStates)[number];

export type TaskComplexity = 'small' | 'medium' | 'large';

export interface TaskNode {
  taskId: string;
  type: string;
  capability: string;
  roleCapability: string;
  complexity: TaskComplexity;
  dependsOn: string[];
  definitionOfReady: string[];
  definitionOfDone: string[];
  maxAttempts: number;
  expectedArtifacts: string[];
  humanGate?: string;
}

export interface TaskGraph extends ProjectScopedContract {
  graphId: string;
  sessionId: string;
  macroTaskId: string;
  macroTaskVersion: number;
  nodes: TaskNode[];
}

export interface RoleProfile extends ProjectScopedContract {
  roleId: string;
  version: string;
  owner: string;
  mission: string;
  acceptedTaskTypes: string[];
  skills: VersionedReference[];
  toolGrantIds: string[];
  forbiddenOutcomes: string[];
  requiredEvidence: string[];
  budgets: ExecutionBudget;
}

export type ToolEffect = 'read' | 'write' | 'external';

export interface ToolGrant extends ProjectScopedContract {
  grantId: string;
  roleId: string;
  connector: string;
  operation: string;
  resourcePattern: string;
  effect: ToolEffect;
  dataClassifications: DataClassification[];
  expiresAt: string;
}

export const workerRunStates = [
  'queued',
  'awaiting_approval',
  'running',
  'blocked',
  'review',
  'completed',
  'failed',
  'cancelled',
] as const;
export type WorkerRunState = (typeof workerRunStates)[number];

export interface WorkerRun extends ProjectScopedContract {
  workerRunId: string;
  runId: string;
  sessionId: string;
  taskId: string;
  roleId: string;
  attempt: number;
  state: WorkerRunState;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface Artifact extends ProjectScopedContract {
  artifactId: string;
  sessionId: string;
  runId: string;
  taskId: string;
  kind: string;
  uri: string;
  mediaType: string;
  contentHash: string;
  createdAt: string;
}

export type ApprovalResult = 'approved' | 'rejected' | 'changes_requested' | 'expired';

export interface ApprovalDecision extends ProjectScopedContract {
  approvalId: string;
  sessionId: string;
  runId?: string;
  targetType: string;
  targetId: string;
  targetVersion: number;
  requesterId: string;
  approverId: string;
  approvalMode?: ProjectApprovalMode;
  soloDevConfirmed?: boolean;
  result: ApprovalResult;
  reason: string;
  decidedAt: string;
}

export type FeedbackKind = 'quality' | 'correction' | 'risk' | 'cost';

export interface Feedback extends ProjectScopedContract {
  feedbackId: string;
  sessionId: string;
  runId?: string;
  artifactId?: string;
  authorId: string;
  kind: FeedbackKind;
  rating: -1 | 0 | 1;
  comment: string;
  createdAt: string;
}
