import {
  type ApprovalDecision,
  type Artifact,
  contractSchemaVersion,
  type DataClassification,
  type ExecutionBudget,
  type EpicPlan,
  type Feedback,
  type MacroTask,
  type ProjectContext,
  type RequestPlan,
  type RoleProfile,
  sessionStates,
  type Session,
  type TaskGraph,
  type DeliveryTicketPlan,
  type TaskNode,
  type ToolGrant,
  type VersionedReference,
  type WorkerRun,
  workerRunStates,
} from './domain';

type UnknownRecord = Record<string, unknown>;

export class ContractValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractValidationError';
  }
}

export function parseProjectContext(value: unknown): ProjectContext {
  const input = record(value, 'ProjectContext');
  return {
    ...base(input, 'ProjectContext'),
    legalEntityId: identifier(input.legalEntityId, 'ProjectContext.legalEntityId'),
    name: text(input.name, 'ProjectContext.name', 200),
    status: choice(input.status, 'ProjectContext.status', ['active', 'suspended', 'archived']),
    repositories: texts(input.repositories, 'ProjectContext.repositories', 1, 20, 300),
    memoryNamespace: identifier(input.memoryNamespace, 'ProjectContext.memoryNamespace'),
    knowledgeNamespace: identifier(input.knowledgeNamespace, 'ProjectContext.knowledgeNamespace'),
    allowedSkills: references(input.allowedSkills, 'ProjectContext.allowedSkills'),
    allowedProviders: texts(input.allowedProviders, 'ProjectContext.allowedProviders', 0, 20, 100),
    dataClassification: choice(input.dataClassification, 'ProjectContext.dataClassification', dataClassifications),
    retentionDays: integer(input.retentionDays, 'ProjectContext.retentionDays', 1, 3_650),
    rtoMinutes: integer(input.rtoMinutes, 'ProjectContext.rtoMinutes', 0, 43_200),
    rpoMinutes: integer(input.rpoMinutes, 'ProjectContext.rpoMinutes', 0, 43_200),
    budgets: budget(input.budgets, 'ProjectContext.budgets'),
  };
}

export function parseSession(value: unknown): Session {
  const input = record(value, 'Session');
  return {
    ...base(input, 'Session'),
    sessionId: identifier(input.sessionId, 'Session.sessionId'),
    version: integer(input.version, 'Session.version', 1, 1_000_000),
    state: choice(input.state, 'Session.state', sessionStates),
    objective: text(input.objective, 'Session.objective', 10_000),
    createdBy: identifier(input.createdBy, 'Session.createdBy'),
    createdAt: date(input.createdAt, 'Session.createdAt'),
    updatedAt: date(input.updatedAt, 'Session.updatedAt'),
  };
}

export function parseMacroTask(value: unknown): MacroTask {
  const input = record(value, 'MacroTask');
  return {
    ...base(input, 'MacroTask'),
    macroTaskId: identifier(input.macroTaskId, 'MacroTask.macroTaskId'),
    version: integer(input.version, 'MacroTask.version', 1, 1_000_000),
    sessionId: identifier(input.sessionId, 'MacroTask.sessionId'),
    objective: text(input.objective, 'MacroTask.objective', 10_000),
    expectedOutcome: text(input.expectedOutcome, 'MacroTask.expectedOutcome', 10_000),
    constraints: texts(input.constraints, 'MacroTask.constraints', 0, 100, 2_000),
    nonGoals: texts(input.nonGoals, 'MacroTask.nonGoals', 0, 100, 2_000),
    deliverables: texts(input.deliverables, 'MacroTask.deliverables', 1, 100, 2_000),
    acceptanceCriteria: texts(input.acceptanceCriteria, 'MacroTask.acceptanceCriteria', 1, 100, 2_000),
    riskLevel: choice(input.riskLevel, 'MacroTask.riskLevel', ['standard', 'sensitive', 'critical']),
    requiredApprovals: integer(input.requiredApprovals, 'MacroTask.requiredApprovals', 0, 2),
    requiredCapabilities: texts(input.requiredCapabilities, 'MacroTask.requiredCapabilities', 1, 50, 100),
    budgets: budget(input.budgets, 'MacroTask.budgets'),
  };
}

export function parseRequestPlan(value: unknown): RequestPlan {
  const input = record(value, 'RequestPlan');
  const epics = items(input.epics, 'RequestPlan.epics', 1, 20).map((item, index) => epicPlan(item, `RequestPlan.epics[${index}]`));
  const tickets = items(input.tickets, 'RequestPlan.tickets', 1, 100).map((item, index) => deliveryTicketPlan(item, `RequestPlan.tickets[${index}]`));
  validateRequestPlan(epics, tickets);
  return {
    ...base(input, 'RequestPlan'),
    sessionId: identifier(input.sessionId, 'RequestPlan.sessionId'),
    objectiveHash: hash(input.objectiveHash, 'RequestPlan.objectiveHash'),
    epics,
    tickets,
  };
}

export function parseTaskGraph(value: unknown): TaskGraph {
  const input = record(value, 'TaskGraph');
  const nodes = items(input.nodes, 'TaskGraph.nodes', 1, 200).map((node, index) => taskNode(node, `TaskGraph.nodes[${index}]`));
  validateGraph(nodes);
  return {
    ...base(input, 'TaskGraph'),
    graphId: identifier(input.graphId, 'TaskGraph.graphId'),
    sessionId: identifier(input.sessionId, 'TaskGraph.sessionId'),
    macroTaskId: identifier(input.macroTaskId, 'TaskGraph.macroTaskId'),
    macroTaskVersion: integer(input.macroTaskVersion, 'TaskGraph.macroTaskVersion', 1, 1_000_000),
    nodes,
  };
}

export function parseRoleProfile(value: unknown): RoleProfile {
  const input = record(value, 'RoleProfile');
  return {
    ...base(input, 'RoleProfile'),
    roleId: identifier(input.roleId, 'RoleProfile.roleId'),
    version: text(input.version, 'RoleProfile.version', 50),
    owner: identifier(input.owner, 'RoleProfile.owner'),
    mission: text(input.mission, 'RoleProfile.mission', 5_000),
    acceptedTaskTypes: texts(input.acceptedTaskTypes, 'RoleProfile.acceptedTaskTypes', 1, 50, 100),
    skills: references(input.skills, 'RoleProfile.skills'),
    toolGrantIds: texts(input.toolGrantIds, 'RoleProfile.toolGrantIds', 0, 100, 128),
    forbiddenOutcomes: texts(input.forbiddenOutcomes, 'RoleProfile.forbiddenOutcomes', 1, 100, 1_000),
    requiredEvidence: texts(input.requiredEvidence, 'RoleProfile.requiredEvidence', 1, 100, 1_000),
    budgets: budget(input.budgets, 'RoleProfile.budgets'),
  };
}

export function parseToolGrant(value: unknown): ToolGrant {
  const input = record(value, 'ToolGrant');
  return {
    ...base(input, 'ToolGrant'),
    grantId: identifier(input.grantId, 'ToolGrant.grantId'),
    roleId: identifier(input.roleId, 'ToolGrant.roleId'),
    connector: identifier(input.connector, 'ToolGrant.connector'),
    operation: identifier(input.operation, 'ToolGrant.operation'),
    resourcePattern: text(input.resourcePattern, 'ToolGrant.resourcePattern', 1_000),
    effect: choice(input.effect, 'ToolGrant.effect', ['read', 'write', 'external']),
    dataClassifications: choices(input.dataClassifications, 'ToolGrant.dataClassifications', dataClassifications),
    expiresAt: date(input.expiresAt, 'ToolGrant.expiresAt'),
  };
}

export function parseWorkerRun(value: unknown): WorkerRun {
  const input = record(value, 'WorkerRun');
  return {
    ...base(input, 'WorkerRun'),
    workerRunId: identifier(input.workerRunId, 'WorkerRun.workerRunId'),
    runId: identifier(input.runId, 'WorkerRun.runId'),
    sessionId: identifier(input.sessionId, 'WorkerRun.sessionId'),
    taskId: identifier(input.taskId, 'WorkerRun.taskId'),
    roleId: identifier(input.roleId, 'WorkerRun.roleId'),
    attempt: integer(input.attempt, 'WorkerRun.attempt', 1, 100),
    state: choice(input.state, 'WorkerRun.state', workerRunStates),
    createdAt: date(input.createdAt, 'WorkerRun.createdAt'),
    startedAt: optionalDate(input.startedAt, 'WorkerRun.startedAt'),
    finishedAt: optionalDate(input.finishedAt, 'WorkerRun.finishedAt'),
  };
}

export function parseArtifact(value: unknown): Artifact {
  const input = record(value, 'Artifact');
  return {
    ...base(input, 'Artifact'),
    artifactId: identifier(input.artifactId, 'Artifact.artifactId'),
    sessionId: identifier(input.sessionId, 'Artifact.sessionId'),
    runId: identifier(input.runId, 'Artifact.runId'),
    taskId: identifier(input.taskId, 'Artifact.taskId'),
    kind: identifier(input.kind, 'Artifact.kind'),
    uri: text(input.uri, 'Artifact.uri', 2_048),
    mediaType: text(input.mediaType, 'Artifact.mediaType', 200),
    contentHash: hash(input.contentHash, 'Artifact.contentHash'),
    createdAt: date(input.createdAt, 'Artifact.createdAt'),
  };
}

export function parseApprovalDecision(value: unknown): ApprovalDecision {
  const input = record(value, 'ApprovalDecision');
  const requesterId = identifier(input.requesterId, 'ApprovalDecision.requesterId');
  const approverId = identifier(input.approverId, 'ApprovalDecision.approverId');
  const approvalMode = optionalChoice(input.approvalMode, 'ApprovalDecision.approvalMode', ['FOUR_EYES', 'SOLO_DEV']);
  const soloDevConfirmed = optionalBoolean(input.soloDevConfirmed, 'ApprovalDecision.soloDevConfirmed');
  if (requesterId === approverId && (approvalMode !== 'SOLO_DEV' || soloDevConfirmed !== true)) {
    fail('ApprovalDecision.approverId must differ from requesterId unless SOLO_DEV is explicitly confirmed');
  }
  return {
    ...base(input, 'ApprovalDecision'),
    approvalId: identifier(input.approvalId, 'ApprovalDecision.approvalId'),
    sessionId: identifier(input.sessionId, 'ApprovalDecision.sessionId'),
    runId: optionalIdentifier(input.runId, 'ApprovalDecision.runId'),
    targetType: identifier(input.targetType, 'ApprovalDecision.targetType'),
    targetId: identifier(input.targetId, 'ApprovalDecision.targetId'),
    targetVersion: integer(input.targetVersion, 'ApprovalDecision.targetVersion', 1, 1_000_000),
    requesterId,
    approverId,
    approvalMode,
    soloDevConfirmed,
    result: choice(input.result, 'ApprovalDecision.result', ['approved', 'rejected', 'changes_requested', 'expired']),
    reason: text(input.reason, 'ApprovalDecision.reason', 2_000),
    decidedAt: date(input.decidedAt, 'ApprovalDecision.decidedAt'),
  };
}

export function parseFeedback(value: unknown): Feedback {
  const input = record(value, 'Feedback');
  const rating = integer(input.rating, 'Feedback.rating', -1, 1);
  if (rating !== -1 && rating !== 0 && rating !== 1) fail('Feedback.rating is invalid');
  return {
    ...base(input, 'Feedback'),
    feedbackId: identifier(input.feedbackId, 'Feedback.feedbackId'),
    sessionId: identifier(input.sessionId, 'Feedback.sessionId'),
    runId: optionalIdentifier(input.runId, 'Feedback.runId'),
    artifactId: optionalIdentifier(input.artifactId, 'Feedback.artifactId'),
    authorId: identifier(input.authorId, 'Feedback.authorId'),
    kind: choice(input.kind, 'Feedback.kind', ['quality', 'correction', 'risk', 'cost']),
    rating,
    comment: text(input.comment, 'Feedback.comment', 5_000),
    createdAt: date(input.createdAt, 'Feedback.createdAt'),
  };
}

const dataClassifications = ['public', 'internal', 'confidential', 'restricted'] as const satisfies readonly DataClassification[];

function base(input: UnknownRecord, path: string) {
  if (input.schemaVersion !== contractSchemaVersion) fail(`${path}.schemaVersion must be ${contractSchemaVersion}`);
  return { schemaVersion: contractSchemaVersion, projectId: identifier(input.projectId, `${path}.projectId`) };
}

function budget(value: unknown, path: string): ExecutionBudget {
  const input = record(value, path);
  return {
    maxDurationMs: integer(input.maxDurationMs, `${path}.maxDurationMs`, 1, 2_592_000_000),
    maxCostCents: integer(input.maxCostCents, `${path}.maxCostCents`, 0, 10_000_000),
    maxContextTokens: integer(input.maxContextTokens, `${path}.maxContextTokens`, 1, 10_000_000),
    maxConcurrency: integer(input.maxConcurrency, `${path}.maxConcurrency`, 1, 100),
  };
}

function references(value: unknown, path: string): VersionedReference[] {
  return items(value, path, 0, 100).map((item, index) => {
    const input = record(item, `${path}[${index}]`);
    return { id: identifier(input.id, `${path}[${index}].id`), version: text(input.version, `${path}[${index}].version`, 50) };
  });
}

function taskNode(value: unknown, path: string): TaskNode {
  const input = record(value, path);
  return {
    taskId: identifier(input.taskId, `${path}.taskId`),
    type: identifier(input.type, `${path}.type`),
    capability: identifier(input.capability, `${path}.capability`),
    roleCapability: identifier(input.roleCapability, `${path}.roleCapability`),
    complexity: choice(input.complexity, `${path}.complexity`, ['small', 'medium', 'large']),
    dependsOn: texts(input.dependsOn, `${path}.dependsOn`, 0, 100, 128),
    definitionOfReady: texts(input.definitionOfReady, `${path}.definitionOfReady`, 1, 100, 1_000),
    definitionOfDone: texts(input.definitionOfDone, `${path}.definitionOfDone`, 1, 100, 1_000),
    maxAttempts: integer(input.maxAttempts, `${path}.maxAttempts`, 1, 10),
    expectedArtifacts: texts(input.expectedArtifacts, `${path}.expectedArtifacts`, 1, 100, 200),
    humanGate: optionalIdentifier(input.humanGate, `${path}.humanGate`),
  };
}

function epicPlan(value: unknown, path: string): EpicPlan {
  const input = record(value, path);
  return {
    epicKey: identifier(input.epicKey, `${path}.epicKey`),
    title: text(input.title, `${path}.title`, 300),
    objective: text(input.objective, `${path}.objective`, 2_000),
    expectedOutcome: text(input.expectedOutcome, `${path}.expectedOutcome`, 2_000),
    acceptanceCriteria: texts(input.acceptanceCriteria, `${path}.acceptanceCriteria`, 1, 50, 1_000),
    ticketKeys: texts(input.ticketKeys, `${path}.ticketKeys`, 1, 100, 128),
  };
}

function deliveryTicketPlan(value: unknown, path: string): DeliveryTicketPlan {
  const input = record(value, path);
  return {
    ticketKey: identifier(input.ticketKey, `${path}.ticketKey`),
    epicKey: identifier(input.epicKey, `${path}.epicKey`),
    title: text(input.title, `${path}.title`, 300),
    description: text(input.description, `${path}.description`, 5_000),
    kind: choice(input.kind, `${path}.kind`, ['discovery', 'architecture', 'implementation', 'verification', 'delivery']),
    capability: identifier(input.capability, `${path}.capability`),
    complexity: choice(input.complexity, `${path}.complexity`, ['small', 'medium', 'large']),
    dependsOn: texts(input.dependsOn, `${path}.dependsOn`, 0, 100, 128),
    acceptanceCriteria: texts(input.acceptanceCriteria, `${path}.acceptanceCriteria`, 1, 50, 1_000),
    definitionOfDone: texts(input.definitionOfDone, `${path}.definitionOfDone`, 1, 50, 1_000),
    expectedArtifacts: texts(input.expectedArtifacts, `${path}.expectedArtifacts`, 1, 20, 200),
  };
}

function validateRequestPlan(epics: EpicPlan[], tickets: DeliveryTicketPlan[]) {
  const epicKeys = uniqueKeys(epics.map(({ epicKey }) => epicKey), 'RequestPlan contains duplicate epicKey');
  const ticketKeys = uniqueKeys(tickets.map(({ ticketKey }) => ticketKey), 'RequestPlan contains duplicate ticketKey');
  const byTicket = new Map(tickets.map((ticket) => [ticket.ticketKey, ticket]));
  for (const ticket of tickets) {
    if (!epicKeys.has(ticket.epicKey)) fail(`RequestPlan epic ${ticket.epicKey} does not exist`);
    for (const dependency of ticket.dependsOn) {
      if (!ticketKeys.has(dependency)) fail(`RequestPlan dependency ${dependency} does not exist`);
      if (dependency === ticket.ticketKey) fail(`RequestPlan ticket ${ticket.ticketKey} depends on itself`);
    }
  }
  const declared = new Set<string>();
  for (const epic of epics) {
    for (const ticketKey of epic.ticketKeys) {
      if (declared.has(ticketKey)) fail(`RequestPlan ticket ${ticketKey} is declared by several epics`);
      const ticket = byTicket.get(ticketKey);
      if (!ticket || ticket.epicKey !== epic.epicKey) fail(`RequestPlan epic ${epic.epicKey} references an invalid ticket ${ticketKey}`);
      declared.add(ticketKey);
    }
  }
  if (declared.size !== tickets.length) fail('RequestPlan contains a ticket not declared by an epic');
  const nodes = tickets.map((ticket) => ({ ...ticket, taskId: ticket.ticketKey, type: ticket.kind, roleCapability: ticket.capability, definitionOfReady: ['Dependencies completed'], maxAttempts: 2 }));
  validateGraph(nodes);
}

function uniqueKeys(values: string[], duplicateMessage: string): Set<string> {
  const keys = new Set<string>();
  for (const value of values) {
    if (keys.has(value)) fail(`${duplicateMessage} ${value}`);
    keys.add(value);
  }
  return keys;
}

function validateGraph(nodes: TaskNode[]) {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.taskId)) fail(`TaskGraph contains duplicate taskId ${node.taskId}`);
    ids.add(node.taskId);
  }
  for (const node of nodes) {
    for (const dependency of node.dependsOn) {
      if (!ids.has(dependency)) fail(`TaskGraph dependency ${dependency} does not exist`);
      if (dependency === node.taskId) fail(`TaskGraph task ${node.taskId} depends on itself`);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(nodes.map((node) => [node.taskId, node]));
  const visit = (taskId: string) => {
    if (visiting.has(taskId)) fail('TaskGraph contains a cycle');
    if (visited.has(taskId)) return;
    visiting.add(taskId);
    for (const dependency of byId.get(taskId)?.dependsOn ?? []) visit(dependency);
    visiting.delete(taskId);
    visited.add(taskId);
  };
  for (const node of nodes) visit(node.taskId);
}

function record(value: unknown, path: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} must be an object`);
  return value as UnknownRecord;
}

function items(value: unknown, path: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(`${path} must contain between ${min} and ${max} items`);
  return value;
}

function texts(value: unknown, path: string, min: number, max: number, maxLength: number): string[] {
  return items(value, path, min, max).map((item, index) => text(item, `${path}[${index}]`, maxLength));
}

function choices<const T extends readonly string[]>(value: unknown, path: string, allowed: T): T[number][] {
  return items(value, path, 1, allowed.length).map((item, index) => choice(item, `${path}[${index}]`, allowed));
}

function text(value: unknown, path: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) fail(`${path} must be a non-empty string of at most ${maxLength} characters`);
  return value;
}

function identifier(value: unknown, path: string): string {
  const result = text(value, path, 128);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(result)) fail(`${path} contains unsupported characters`);
  return result;
}

function optionalIdentifier(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : identifier(value, path);
}

function integer(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) fail(`${path} must be an integer between ${min} and ${max}`);
  return value;
}

function choice<const T extends readonly string[]>(value: unknown, path: string, allowed: T): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) fail(`${path} must be one of ${allowed.join(', ')}`);
  return value as T[number];
}

function optionalChoice<const T extends readonly string[]>(value: unknown, path: string, allowed: T): T[number] | undefined {
  return value === undefined ? undefined : choice(value, path, allowed);
}

function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') fail(`${path} must be a boolean`);
  return value;
}

function date(value: unknown, path: string): string {
  const result = text(value, path, 50);
  if (Number.isNaN(Date.parse(result))) fail(`${path} must be an ISO date`);
  return result;
}

function optionalDate(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : date(value, path);
}

function hash(value: unknown, path: string): string {
  const result = text(value, path, 64);
  if (!/^[a-f0-9]{64}$/.test(result)) fail(`${path} must be a lowercase SHA-256 hash`);
  return result;
}

function fail(message: string): never {
  throw new ContractValidationError(message);
}
