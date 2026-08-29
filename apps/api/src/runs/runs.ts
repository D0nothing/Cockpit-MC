import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient, type RunEvent, type RunTask } from '@prisma/client';
import {
  contractSchemaVersion,
  parseMacroTask,
  parseTaskGraph,
  type MacroTask as MacroTaskContract,
  type RequestPlan,
  type TaskGraph as TaskGraphContract,
  type WorkerRunState,
} from '@software-factory/contracts';
import { recordAudit } from '../audit/audit';
import { projectApprovalPolicyReadModel, projectPolicySelect } from '../control/project-approval-policy';
import { HttpError, requireDatabase } from '../http';
import { buildRequestPlan, requestPlanToTaskNodes } from '../planning/planner';

const simulatorCapacity = 2;
const defaultBudget = { maxDurationMs: 300_000, maxCostCents: 0, maxContextTokens: 20_000, maxConcurrency: simulatorCapacity };

export async function listProjects(prisma: PrismaClient) {
  requireDatabase();
  const projects = await prisma.project.findMany({
    orderBy: { name: 'asc' },
    select: projectPolicySelect,
  });
  return projects.map((project) => projectApprovalPolicyReadModel(project));
}

export function listSessions(prisma: PrismaClient, projectId: string) {
  requireDatabase();
  return prisma.workSession.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: { macroTasks: { orderBy: { version: 'desc' }, take: 1 }, runs: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
}

export async function createSession(prisma: PrismaClient, body: unknown) {
  requireDatabase();
  const input = bodyRecord(body);
  const projectId = bodyString(input, 'projectId', 128);
  const objective = bodyString(input, 'objective', 10_000);
  const createdBy = bodyString(input, 'createdBy', 128);
  const idempotencyKey = bodyString(input, 'idempotencyKey', 128);
  const riskLevel = bodyChoice(input, 'riskLevel', ['standard', 'sensitive', 'critical'], 'standard');
  const project = await prisma.project.findFirst({ where: { id: projectId, status: 'active' }, select: { id: true } });
  if (!project) throw new HttpError(404, 'Active project not found');

  const existing = await prisma.workSession.findUnique({ where: { projectId_idempotencyKey: { projectId, idempotencyKey } } });
  if (existing) {
    if (existing.objective !== objective || existing.createdBy !== createdBy || existing.riskLevel !== riskLevel) throw new HttpError(409, 'Idempotency key already used with another request');
    return getSession(prisma, existing.id, projectId);
  }

  const session = await prisma.workSession.create({ data: { projectId, objective, riskLevel, createdBy, idempotencyKey } });
  await recordAudit(prisma, { projectId, actorId: createdBy, action: 'session.created', targetType: 'session', targetId: session.id, metadata: { objectiveHash: createHash('sha256').update(objective).digest('hex') } });
  return getSession(prisma, session.id, projectId);
}

export async function getSession(prisma: PrismaClient, sessionId: string, projectId: string) {
  requireDatabase();
  const session = await prisma.workSession.findFirst({
    where: { id: sessionId, projectId },
    include: {
      project: { select: { id: true, name: true, slug: true, status: true } },
      macroTasks: { orderBy: { version: 'desc' }, include: { graph: true } },
      epics: { orderBy: { sequence: 'asc' }, include: { tickets: { orderBy: { externalId: 'asc' }, include: { specification: true } } } },
      runs: { orderBy: { createdAt: 'desc' }, select: { id: true, state: true, correlationId: true, createdAt: true, updatedAt: true } },
    },
  });
  if (!session) throw new HttpError(404, 'Session not found');
  return session;
}

export async function planSession(prisma: PrismaClient, sessionId: string, body: unknown) {
  requireDatabase();
  const input = bodyRecord(body);
  const projectId = bodyString(input, 'projectId', 128);
  const actorId = bodyString(input, 'actorId', 128);
  const session = await prisma.workSession.findFirst({
    where: { id: sessionId, projectId },
    include: { macroTasks: { orderBy: { version: 'desc' }, take: 1, include: { graph: true } } },
  });
  if (!session) throw new HttpError(404, 'Session not found');
  if (session.macroTasks[0]?.graph) return getSession(prisma, sessionId, projectId);
  if (!['created', 'planning'].includes(session.state)) throw new HttpError(409, `Session cannot be planned from ${session.state}`);

  const plan = buildDeterministicPlan({ projectId, sessionId, objective: session.objective, riskLevel: session.riskLevel });
  const requiresApproval = plan.macroTask.requiredApprovals > 0;
  await prisma.$transaction(async (tx) => {
    const ticketCounter = await tx.project.update({
      where: { id: projectId },
      data: { nextTicketNumber: { increment: plan.requestPlan.tickets.length } },
      select: { nextTicketNumber: true },
    });
    const firstTicketNumber = ticketCounter.nextTicketNumber - plan.requestPlan.tickets.length;
    await tx.workSession.update({ where: { id: sessionId }, data: { state: requiresApproval ? 'awaiting_approval' : 'ready', version: { increment: 1 } } });
    await tx.macroTask.create({
      data: {
        id: plan.macroTask.macroTaskId,
        projectId,
        sessionId,
        version: plan.macroTask.version,
        objective: plan.macroTask.objective,
        expectedOutcome: plan.macroTask.expectedOutcome,
        constraints: plan.macroTask.constraints,
        nonGoals: plan.macroTask.nonGoals,
        deliverables: plan.macroTask.deliverables,
        acceptanceCriteria: plan.macroTask.acceptanceCriteria,
        riskLevel: plan.macroTask.riskLevel,
        requiredApprovals: plan.macroTask.requiredApprovals,
        requiredCapabilities: plan.macroTask.requiredCapabilities,
        budgets: plan.macroTask.budgets as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.taskGraph.create({
      data: {
        id: plan.graph.graphId,
        projectId,
        sessionId,
        macroTaskId: plan.macroTask.macroTaskId,
        version: 1,
        nodes: plan.graph.nodes as unknown as Prisma.InputJsonValue,
      },
    });
    const epicIds = new Map(plan.requestPlan.epics.map((epic) => [epic.epicKey, `epic-${sessionId}-${epic.epicKey}`]));
    const resolveEpicId = (epicKey: string) => {
      const epicId = epicIds.get(epicKey);
      if (!epicId) throw new HttpError(500, `Planned epic ${epicKey} is missing`);
      return epicId;
    };
    await tx.epic.createMany({
      data: plan.requestPlan.epics.map((epic, sequence) => ({ id: resolveEpicId(epic.epicKey), projectId, sessionId, key: epic.epicKey, title: epic.title, objective: epic.objective, expectedOutcome: epic.expectedOutcome, acceptanceCriteria: epic.acceptanceCriteria, sequence: sequence + 1 })),
    });
    const persistedTickets = plan.requestPlan.tickets.map((ticket, index) => ({ id: `ticket-${randomUUID()}`, externalId: firstTicketNumber + index, ticket }));
    await tx.ticket.createMany({
      data: persistedTickets.map(({ id, externalId, ticket }) => ({ id, externalId, title: ticket.title, description: ticket.description, labels: ['vistory-plan', ticket.capability, ticket.kind], status: 'context_ready', riskLevel: plan.macroTask.riskLevel, projectId, epicId: resolveEpicId(ticket.epicKey), sourceSessionId: sessionId, plannerKey: ticket.ticketKey, kind: ticket.kind, capability: ticket.capability, complexity: ticket.complexity, dependsOn: ticket.dependsOn, acceptanceCriteria: ticket.acceptanceCriteria, definitionOfDone: ticket.definitionOfDone })),
    });
    await tx.specification.createMany({
      data: persistedTickets.map(({ id, ticket }) => ({ ticketId: id, content: plannedSpecification(ticket.title, ticket.description, ticket.acceptanceCriteria, ticket.definitionOfDone), generatedFromHash: plan.requestPlan.objectiveHash, status: 'DRAFT' })),
    });
    if (requiresApproval) {
      await tx.approvalRequest.create({
        data: {
          projectId,
          sessionId,
          macroTaskId: plan.macroTask.macroTaskId,
          targetVersion: plan.macroTask.version,
          riskLevel: plan.macroTask.riskLevel,
          requiredApprovals: plan.macroTask.requiredApprovals,
          requesterId: actorId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
        },
      });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await recordAudit(prisma, { projectId, actorId, action: 'session.planned', targetType: 'session', targetId: sessionId, metadata: { macroTaskId: plan.macroTask.macroTaskId, graphId: plan.graph.graphId, epics: plan.requestPlan.epics.length, tickets: plan.requestPlan.tickets.length, requiredApprovals: plan.macroTask.requiredApprovals } });
  return getSession(prisma, sessionId, projectId);
}

export async function reviseSession(prisma: PrismaClient, sessionId: string, body: unknown) {
  requireDatabase();
  const input = bodyRecord(body);
  const projectId = bodyString(input, 'projectId', 128);
  const actorId = bodyString(input, 'actorId', 128);
  const objective = bodyString(input, 'objective', 10_000);
  const session = await prisma.workSession.findFirst({
    where: { id: sessionId, projectId },
    include: {
      macroTasks: { orderBy: { version: 'desc' }, take: 1, include: { graph: true } },
      epics: { select: { id: true, key: true } },
      plannedTickets: { select: { id: true, plannerKey: true } },
      runs: { select: { id: true }, take: 1 },
    },
  });
  if (!session) throw new HttpError(404, 'Session not found');
  if (session.objective === objective) return getSession(prisma, sessionId, projectId);
  if (session.runs.length > 0) throw new HttpError(409, 'A session with a run cannot be revised');
  if (!['planning', 'awaiting_approval', 'ready'].includes(session.state)) throw new HttpError(409, `Session cannot be revised from ${session.state}`);
  const currentMacroTask = session.macroTasks[0];
  if (!currentMacroTask?.graph) throw new HttpError(409, 'A planned session is required');

  const nextVersion = currentMacroTask.version + 1;
  const plan = buildDeterministicPlan({ projectId, sessionId, objective, riskLevel: session.riskLevel, version: nextVersion });
  const epics = new Map(session.epics.map((epic) => [epic.key, epic.id]));
  const tickets = new Map(session.plannedTickets.flatMap((ticket) => ticket.plannerKey ? [[ticket.plannerKey, ticket.id] as const] : []));
  const plannedEpicKeys = plan.requestPlan.epics.map(({ epicKey }) => epicKey).sort();
  const plannedTicketKeys = plan.requestPlan.tickets.map(({ ticketKey }) => ticketKey).sort();
  if (JSON.stringify([...epics.keys()].sort()) !== JSON.stringify(plannedEpicKeys) || JSON.stringify([...tickets.keys()].sort()) !== JSON.stringify(plannedTicketKeys)) {
    throw new HttpError(409, 'A revision cannot change persisted plan topology');
  }
  const requiresApproval = plan.macroTask.requiredApprovals > 0;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.workSession.updateMany({
      where: { id: sessionId, projectId, version: session.version },
      data: { objective, state: requiresApproval ? 'awaiting_approval' : 'ready', version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new HttpError(409, 'Session was revised concurrently');
    await tx.approvalRequest.updateMany({ where: { sessionId, status: 'pending' }, data: { status: 'changes_requested' } });
    await tx.macroTask.create({
      data: {
        id: plan.macroTask.macroTaskId,
        projectId,
        sessionId,
        version: plan.macroTask.version,
        objective: plan.macroTask.objective,
        expectedOutcome: plan.macroTask.expectedOutcome,
        constraints: plan.macroTask.constraints,
        nonGoals: plan.macroTask.nonGoals,
        deliverables: plan.macroTask.deliverables,
        acceptanceCriteria: plan.macroTask.acceptanceCriteria,
        riskLevel: plan.macroTask.riskLevel,
        requiredApprovals: plan.macroTask.requiredApprovals,
        requiredCapabilities: plan.macroTask.requiredCapabilities,
        budgets: plan.macroTask.budgets as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.taskGraph.create({
      data: {
        id: plan.graph.graphId,
        projectId,
        sessionId,
        macroTaskId: plan.macroTask.macroTaskId,
        version: plan.graph.macroTaskVersion,
        nodes: plan.graph.nodes as unknown as Prisma.InputJsonValue,
      },
    });
    for (const [sequence, epic] of plan.requestPlan.epics.entries()) {
      await tx.epic.update({ where: { id: epics.get(epic.epicKey) }, data: { title: epic.title, objective: epic.objective, expectedOutcome: epic.expectedOutcome, acceptanceCriteria: epic.acceptanceCriteria, sequence: sequence + 1, status: 'planned' } });
    }
    for (const ticket of plan.requestPlan.tickets) {
      const ticketId = tickets.get(ticket.ticketKey);
      if (!ticketId) throw new HttpError(409, `Persisted ticket ${ticket.ticketKey} is missing`);
      await tx.ticket.update({
        where: { id: ticketId },
        data: { title: ticket.title, description: ticket.description, labels: ['vistory-plan', ticket.capability, ticket.kind], status: 'context_ready', kind: ticket.kind, capability: ticket.capability, complexity: ticket.complexity, dependsOn: ticket.dependsOn, acceptanceCriteria: ticket.acceptanceCriteria, definitionOfDone: ticket.definitionOfDone },
      });
      await tx.specification.update({
        where: { ticketId },
        data: { content: plannedSpecification(ticket.title, ticket.description, ticket.acceptanceCriteria, ticket.definitionOfDone), generatedFromHash: plan.requestPlan.objectiveHash, status: 'DRAFT', version: { increment: 1 } },
      });
    }
    if (requiresApproval) {
      await tx.approvalRequest.create({
        data: { projectId, sessionId, macroTaskId: plan.macroTask.macroTaskId, targetVersion: plan.macroTask.version, riskLevel: plan.macroTask.riskLevel, requiredApprovals: plan.macroTask.requiredApprovals, requesterId: actorId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000) },
      });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await recordAudit(prisma, { projectId, actorId, action: 'session.revised', targetType: 'session', targetId: sessionId, metadata: { fromVersion: currentMacroTask.version, toVersion: nextVersion, objectiveHash: plan.requestPlan.objectiveHash, epics: plan.requestPlan.epics.length, tickets: plan.requestPlan.tickets.length, requiredApprovals: plan.macroTask.requiredApprovals } });
  return getSession(prisma, sessionId, projectId);
}

export function listBacklog(prisma: PrismaClient, projectId: string) {
  requireDatabase();
  return prisma.epic.findMany({
    where: { projectId },
    orderBy: [{ createdAt: 'desc' }, { sequence: 'asc' }],
    take: 100,
    include: { session: { select: { id: true, objective: true, state: true, riskLevel: true } }, tickets: { orderBy: { externalId: 'asc' }, include: { specification: true, workflow: true } } },
  });
}

export function listRuns(prisma: PrismaClient, projectId: string) {
  requireDatabase();
  return prisma.executionRun.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: { session: { select: { objective: true } }, tasks: { select: { state: true } } },
  });
}

export async function startRun(prisma: PrismaClient, sessionId: string, body: unknown) {
  requireDatabase();
  const input = bodyRecord(body);
  const projectId = bodyString(input, 'projectId', 128);
  const actorId = bodyString(input, 'actorId', 128);
  const idempotencyKey = bodyString(input, 'idempotencyKey', 128);
  const existing = await prisma.executionRun.findUnique({ where: { projectId_idempotencyKey: { projectId, idempotencyKey } } });
  if (existing) {
    if (existing.sessionId !== sessionId) throw new HttpError(409, 'Idempotency key already used with another session');
    return getRun(prisma, existing.id, projectId);
  }

  const session = await prisma.workSession.findFirst({
    where: { id: sessionId, projectId, project: { status: 'active' } },
    include: {
      macroTasks: { orderBy: { version: 'desc' }, take: 1, include: { graph: true, approvalRequest: true } },
      plannedTickets: { select: { id: true, plannerKey: true, workflow: true } },
    },
  });
  const macroTask = session?.macroTasks[0];
  if (!session || !macroTask?.graph) throw new HttpError(409, 'A planned session is required');
  if (session.state !== 'ready') throw new HttpError(409, `Session cannot start from ${session.state}`);
  if (macroTask.requiredApprovals > 0 && macroTask.approvalRequest?.status !== 'approved') throw new HttpError(403, 'Required human approval is missing');
  const graph = parsePersistedGraph(projectId, sessionId, macroTask.id, macroTask.version, macroTask.graph.id, macroTask.graph.nodes);
  const ticketsByPlannerKey = new Map(session.plannedTickets.flatMap((ticket) => ticket.plannerKey ? [[ticket.plannerKey, ticket] as const] : []));
  const ticketIds = new Map([...ticketsByPlannerKey].map(([key, ticket]) => [key, ticket.id] as const));
  if (graph.nodes.some((node) => !ticketIds.has(node.taskId))) throw new HttpError(409, 'Every run task must reference a planned ticket');
  const reconciledTaskIds = reconciledWorkflowTaskIds(graph.nodes, ticketsByPlannerKey);
  const correlationId = `correlation-${randomUUID()}`;

  const run = await prisma.$transaction(async (tx) => {
    const allReconciled = reconciledTaskIds.size === graph.nodes.length;
    const initialState = allReconciled ? 'review' as const : reconciledTaskIds.size > 0 ? 'running' as const : 'queued' as const;
    const eventCount = 1 + (reconciledTaskIds.size > 0 ? 1 : 0) + reconciledTaskIds.size + (allReconciled ? 1 : 0);
    const created = await tx.executionRun.create({
      data: { projectId, sessionId, macroTaskId: macroTask.id, graphId: graph.graphId, correlationId, idempotencyKey, state: initialState, lastSequence: eventCount },
    });
    await tx.runTask.createMany({
      data: graph.nodes.map((node) => ({
        projectId,
        runId: created.id,
        ticketId: ticketIds.get(node.taskId),
        taskId: node.taskId,
        type: node.type,
        capability: node.capability,
        roleCapability: node.roleCapability,
        complexity: node.complexity,
        dependsOn: node.dependsOn,
        state: reconciledTaskIds.has(node.taskId) ? 'completed' : node.dependsOn.every((dependency) => reconciledTaskIds.has(dependency)) ? 'ready' : 'blocked',
        maxAttempts: node.maxAttempts,
        definitionOfReady: node.definitionOfReady,
        definitionOfDone: node.definitionOfDone,
        expectedArtifacts: node.expectedArtifacts,
      })),
    });
    await tx.runEvent.create({
      data: eventData(created.id, projectId, sessionId, correlationId, 1, 'run.queued', 'human', actorId, { macroTaskId: macroTask.id, graphId: graph.graphId }),
    });
    let sequence = 1;
    if (reconciledTaskIds.size > 0) {
      sequence += 1;
      await tx.runEvent.create({ data: eventData(created.id, projectId, sessionId, correlationId, sequence, 'run.running', 'human', actorId, { reconciledTasks: reconciledTaskIds.size }) });
    }
    for (const taskId of reconciledTaskIds) {
      const workflow = ticketsByPlannerKey.get(taskId)?.workflow;
      if (!workflow?.pullRequestUrl || !workflow.headCommitSha) continue;
      sequence += 1;
      await tx.runArtifact.create({
        data: {
          id: `artifact-${randomUUID()}`,
          projectId,
          sessionId,
          runId: created.id,
          taskId,
          kind: 'pull_request',
          uri: workflow.pullRequestUrl,
          mediaType: 'text/uri-list',
          contentHash: createHash('sha256').update(workflow.headCommitSha).digest('hex'),
        },
      });
      await tx.runEvent.create({ data: eventData(created.id, projectId, sessionId, correlationId, sequence, 'task.reconciled', 'human', actorId, { taskId, pullRequestUrl: workflow.pullRequestUrl, headCommitSha: workflow.headCommitSha }) });
    }
    if (allReconciled) {
      sequence += 1;
      await tx.runEvent.create({ data: eventData(created.id, projectId, sessionId, correlationId, sequence, 'run.review_required', 'human', actorId, { reconciledTasks: reconciledTaskIds.size }) });
    }
    await tx.workSession.update({ where: { id: sessionId }, data: { state: allReconciled ? 'review' : 'running', version: { increment: 1 } } });
    return created;
  });
  await recordAudit(prisma, { projectId, actorId, action: 'run.started', targetType: 'run', targetId: run.id, metadata: { sessionId, correlationId, reconciledTasks: [...reconciledTaskIds] } });
  return getRun(prisma, run.id, projectId);
}

export function reconciledWorkflowTaskIds(
  nodes: readonly { taskId: string; dependsOn: string[] }[],
  tickets: ReadonlyMap<string, { workflow: { branchName: string | null; pullRequestUrl: string | null; headCommitSha: string | null; ciStatus: string | null; reconciledAt: Date | null } | null }>,
): Set<string> {
  const completed = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (completed.has(node.taskId) || !node.dependsOn.every((dependency) => completed.has(dependency))) continue;
      const workflow = tickets.get(node.taskId)?.workflow;
      const valid = workflow?.ciStatus === 'success'
        && workflow.reconciledAt !== null
        && Boolean(workflow.pullRequestUrl)
        && Boolean(workflow.headCommitSha && /^[a-f0-9]{40}$/i.test(workflow.headCommitSha))
        && Boolean(workflow.branchName && /^codex\/[A-Za-z0-9._/-]{1,90}$/.test(workflow.branchName));
      if (!valid) continue;
      completed.add(node.taskId);
      changed = true;
    }
  }
  return completed;
}

export async function getRun(prisma: PrismaClient, runId: string, projectId: string) {
  requireDatabase();
  const run = await prisma.executionRun.findFirst({
    where: { id: runId, projectId },
    include: {
      project: { select: { id: true, name: true, slug: true } },
      session: { select: { id: true, objective: true, state: true, version: true } },
      macroTask: true,
      graph: true,
      tasks: {
        orderBy: [{ createdAt: 'asc' }, { taskId: 'asc' }],
        include: {
          ticket: { select: { id: true, externalId: true, title: true, status: true, epic: { select: { id: true, key: true, title: true, status: true } } } },
          dispatches: { orderBy: { createdAt: 'desc' }, take: 10, include: { artifacts: { orderBy: { createdAt: 'asc' } } } },
        },
      },
      events: { orderBy: { sequence: 'asc' }, take: 500 },
      artifacts: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!run) throw new HttpError(404, 'Run not found');
  return { ...run, storedState: run.state, state: deriveRunState(run.events) };
}

export async function commandRun(prisma: PrismaClient, runId: string, body: unknown) {
  requireDatabase();
  const input = bodyRecord(body);
  const projectId = bodyString(input, 'projectId', 128);
  const actorId = bodyString(input, 'actorId', 128);
  const idempotencyKey = bodyString(input, 'idempotencyKey', 128);
  const type = bodyChoice(input, 'type', ['pause', 'resume', 'cancel'], 'pause');
  const existing = await prisma.runCommand.findUnique({ where: { projectId_idempotencyKey: { projectId, idempotencyKey } } });
  if (existing) {
    if (existing.runId !== runId || existing.type !== type) throw new HttpError(409, 'Idempotency key already used with another command');
    return existing;
  }
  const run = await prisma.executionRun.findFirst({ where: { id: runId, projectId } });
  if (!run) throw new HttpError(404, 'Run not found');
  const nextState = commandState(run.state, type);
  if (!nextState) {
    await recordAudit(prisma, { projectId, actorId, action: 'run.command_refused', targetType: 'run', targetId: runId, metadata: { type, state: run.state } });
    throw new HttpError(409, `Command ${type} is not allowed from ${run.state}`);
  }
  const sequence = run.lastSequence + 1;
  const sessionState = nextState === 'blocked' ? 'blocked' : nextState === 'cancelled' ? 'cancelled' : 'running';
  const command = await prisma.$transaction(async (tx) => {
    const created = await tx.runCommand.create({ data: { projectId, runId, idempotencyKey, type, actorId, resultState: nextState } });
    await tx.runEvent.create({ data: eventData(run.id, projectId, run.sessionId, run.correlationId, sequence, `run.${nextState}`, 'human', actorId, { commandId: created.id, command: type }) });
    await tx.executionRun.update({ where: { id: runId }, data: { state: nextState, lastSequence: sequence } });
    await tx.workSession.update({ where: { id: run.sessionId }, data: { state: sessionState, version: { increment: 1 } } });
    return created;
  });
  await recordAudit(prisma, { projectId, actorId, action: `run.${type}`, targetType: 'run', targetId: runId, metadata: { commandId: command.id, resultState: nextState } });
  return command;
}

export function buildDeterministicPlan(input: { projectId: string; sessionId: string; objective: string; riskLevel?: 'standard' | 'sensitive' | 'critical'; version?: number }): { macroTask: MacroTaskContract; graph: TaskGraphContract; requestPlan: RequestPlan } {
  const version = input.version ?? 1;
  const macroTaskId = `macro-${input.sessionId}-v${version}`;
  const riskLevel = input.riskLevel ?? 'standard';
  const requestPlan = buildRequestPlan({ ...input, riskLevel });
  const nodes = requestPlanToTaskNodes(requestPlan);
  const macroTask = parseMacroTask({
    schemaVersion: contractSchemaVersion,
    projectId: input.projectId,
    macroTaskId,
    version,
    sessionId: input.sessionId,
    objective: input.objective,
    expectedOutcome: 'Un résultat vérifiable, prêt pour une revue humaine.',
    constraints: ['Aucun effet externe depuis le worker simulé', 'Conserver projectId et sessionId'],
    nonGoals: ['Aucun déploiement', 'Aucun merge automatique'],
    deliverables: ['Plan d’epics', 'Tickets dépendants', 'Artefacts de développement', 'Rapport de vérification'],
    acceptanceCriteria: ['Les epics couvrent la demande', 'Chaque ticket possède des critères et une définition de fini', 'Toutes les tâches respectent leurs dépendances', 'Le run atteint la revue humaine'],
    riskLevel,
    requiredApprovals: approvalRequirement(riskLevel),
    requiredCapabilities: [...new Set(nodes.map(({ capability }) => capability))],
    budgets: defaultBudget,
  });
  const graph = parseTaskGraph({
    schemaVersion: contractSchemaVersion,
    projectId: input.projectId,
    graphId: `graph-${input.sessionId}-v${version}`,
    sessionId: input.sessionId,
    macroTaskId,
    macroTaskVersion: version,
    nodes,
  });
  return { macroTask, graph, requestPlan };
}

export function approvalRequirement(riskLevel: 'standard' | 'sensitive' | 'critical'): number {
  if (riskLevel === 'critical') return 2;
  if (riskLevel === 'sensitive') return 1;
  return 0;
}

export function scheduleWaves(tasks: readonly Pick<RunTask, 'id' | 'taskId' | 'dependsOn' | 'attempt' | 'expectedArtifacts'>[], capacity: number) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) throw new HttpError(500, 'Scheduler capacity is invalid');
  const pending = new Map(tasks.map((task) => [task.taskId, task]));
  const completed = new Set<string>();
  const waves: Array<Array<(typeof tasks)[number]>> = [];
  while (pending.size > 0) {
    const ready = [...pending.values()].filter((task) => task.dependsOn.every((dependency) => completed.has(dependency))).slice(0, capacity);
    if (ready.length === 0) throw new HttpError(409, 'Task graph is blocked or cyclic');
    waves.push(ready);
    for (const task of ready) {
      pending.delete(task.taskId);
      completed.add(task.taskId);
    }
  }
  return waves;
}

export function deriveRunState(events: readonly Pick<RunEvent, 'type'>[]): WorkerRunState {
  let state: WorkerRunState = 'queued';
  for (const event of events) {
    if (event.type === 'run.running') state = 'running';
    if (event.type === 'run.review_required') state = 'review';
    if (event.type === 'run.completed') state = 'completed';
    if (event.type === 'run.failed') state = 'failed';
    if (event.type === 'run.cancelled') state = 'cancelled';
    if (event.type === 'run.blocked') state = 'blocked';
    if (event.type === 'run.awaiting_approval') state = 'awaiting_approval';
  }
  return state;
}

function commandState(state: string, command: 'pause' | 'resume' | 'cancel') {
  if (command === 'pause' && (state === 'queued' || state === 'running')) return 'blocked' as const;
  if (command === 'resume' && state === 'blocked') return 'queued' as const;
  if (command === 'cancel' && ['queued', 'running', 'blocked', 'awaiting_approval'].includes(state)) return 'cancelled' as const;
  return null;
}

function parsePersistedGraph(projectId: string, sessionId: string, macroTaskId: string, macroTaskVersion: number, graphId: string, nodes: unknown) {
  return parseTaskGraph({ schemaVersion: contractSchemaVersion, projectId, sessionId, macroTaskId, macroTaskVersion, graphId, nodes });
}

function plannedSpecification(title: string, description: string, acceptanceCriteria: string[], definitionOfDone: string[]): string {
  return [
    `# ${title}`,
    '',
    description,
    '',
    '## Critères d’acceptation',
    '',
    ...acceptanceCriteria.map((criterion) => `- ${criterion}`),
    '',
    '## Définition de fini',
    '',
    ...definitionOfDone.map((criterion) => `- ${criterion}`),
  ].join('\n');
}

function eventData(
  runId: string,
  projectId: string,
  sessionId: string,
  correlationId: string,
  sequence: number,
  type: string,
  actorType: string,
  actorId: string,
  payload: Record<string, unknown>,
) {
  return {
    id: `event-${runId}-${sequence}`,
    projectId,
    sessionId,
    runId,
    sequence,
    type,
    correlationId,
    actorType,
    actorId,
    payload: payload as Prisma.InputJsonValue,
  };
}

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Request body must be an object');
  return value as Record<string, unknown>;
}

function bodyString(input: Record<string, unknown>, key: string, maxLength: number): string {
  const value = input[key];
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) throw new HttpError(400, `${key} is invalid`);
  return value;
}

function bodyChoice<const T extends readonly string[]>(input: Record<string, unknown>, key: string, allowed: T, fallback: T[number]): T[number] {
  const value = input[key] ?? fallback;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) throw new HttpError(400, `${key} is invalid`);
  return value as T[number];
}
