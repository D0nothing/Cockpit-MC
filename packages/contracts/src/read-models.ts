import type { ProjectApprovalMode, ProjectStatus, TaskNode, TaskState, WorkerRunState } from './domain';

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  profileVersion: number;
  githubOwner: string;
  githubRepository: string;
  approvalMode: ProjectApprovalMode;
  effectiveApprovalMode: ProjectApprovalMode;
  approvalPolicyVersion: number;
  soloDevExpiresAt: string | null;
  approvalPolicyUpdatedAt: string | null;
  approvalPolicyUpdatedBy: string | null;
  approvalPolicyReason: string | null;
}

export interface RunSummary {
  id: string;
  projectId: string;
  sessionId: string;
  state: WorkerRunState;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
  session: { objective: string };
  tasks: Array<{ state: TaskState }>;
}

export interface RunEventSummary {
  id: string;
  sequence: number;
  type: string;
  actorType: string;
  actorId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface RunTaskSummary {
  id: string;
  taskId: string;
  capability: string;
  dependsOn: string[];
  state: TaskState;
  attempt: number;
  ticket: {
    id: string;
    externalId: number;
    title: string;
    status: string;
    epic: { id: string; key: string; title: string; status: string } | null;
  } | null;
  dispatches: Array<{
    id: string;
    provider: string;
    state: string;
    report: string | null;
    error: string | null;
    artifacts: RunArtifactSummary[];
  }>;
}

export interface RunArtifactSummary {
  id: string;
  taskId: string;
  kind: string;
  uri: string;
  mediaType: string;
  contentHash: string;
}

export interface RunReadModel {
  id: string;
  projectId: string;
  sessionId: string;
  state: WorkerRunState;
  storedState: WorkerRunState;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string; slug: string };
  session: { id: string; objective: string; state: string; version: number };
  macroTask: {
    id: string;
    version: number;
    objective: string;
    expectedOutcome: string;
    acceptanceCriteria: string[];
    requiredCapabilities: string[];
  };
  graph: { id: string; version: number; nodes: TaskNode[] };
  tasks: RunTaskSummary[];
  events: RunEventSummary[];
  artifacts: RunArtifactSummary[];
}
