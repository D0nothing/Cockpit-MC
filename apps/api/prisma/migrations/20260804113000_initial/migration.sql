-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PROJECT_MANAGER', 'ASSIGNEE', 'SECONDARY_VALIDATOR');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('imported', 'assigned', 'context_ready', 'spec_generating', 'spec_review_required', 'spec_validated', 'second_validation_required', 'ready_for_ai', 'ai_requested', 'ai_running', 'branch_created', 'pr_draft_created', 'ci_running', 'human_review_required', 'done', 'blocked', 'rejected');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('standard', 'sensitive', 'critical');

-- CreateEnum
CREATE TYPE "SpecStatus" AS ENUM ('DRAFT', 'REVIEW_REQUIRED', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ValidationKind" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "WorkflowMode" AS ENUM ('MANUAL', 'AI_ANALYSIS', 'CODEX');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "SessionState" AS ENUM ('created', 'planning', 'awaiting_approval', 'ready', 'running', 'review', 'completed', 'blocked', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "RunState" AS ENUM ('queued', 'awaiting_approval', 'running', 'blocked', 'review', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "RunTaskState" AS ENUM ('draft', 'blocked', 'ready', 'dispatched', 'running', 'review', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL DEFAULT 'unclassified',
    "profileVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "memoryNamespace" TEXT NOT NULL DEFAULT 'unconfigured',
    "knowledgeNamespace" TEXT NOT NULL DEFAULT 'unconfigured',
    "githubOwner" TEXT NOT NULL,
    "githubRepository" TEXT NOT NULL,
    "confluenceSpaceKey" TEXT,
    "requireSecondaryForSensitive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "externalId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "labels" TEXT[],
    "status" "TicketStatus" NOT NULL DEFAULT 'imported',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'standard',
    "projectId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Specification" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "status" "SpecStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedFromHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Specification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Validation" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "validatorId" TEXT NOT NULL,
    "kind" "ValidationKind" NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Validation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "mode" "WorkflowMode" NOT NULL,
    "githubRunId" TEXT,
    "branchName" TEXT,
    "pullRequestUrl" TEXT,
    "ciStatus" TEXT,
    "agentReport" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "previousHash" TEXT,
    "integrityHash" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrityProof" (
    "id" TEXT NOT NULL,
    "fromEventId" TEXT NOT NULL,
    "toEventId" TEXT NOT NULL,
    "merkleRoot" TEXT NOT NULL,
    "chainTransactionId" TEXT,
    "anchoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrityProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "state" "SessionState" NOT NULL DEFAULT 'created',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MacroTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "objective" TEXT NOT NULL,
    "expectedOutcome" TEXT NOT NULL,
    "constraints" TEXT[],
    "nonGoals" TEXT[],
    "deliverables" TEXT[],
    "acceptanceCriteria" TEXT[],
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'standard',
    "requiredApprovals" INTEGER NOT NULL DEFAULT 0,
    "requiredCapabilities" TEXT[],
    "budgets" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MacroTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskGraph" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "macroTaskId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "nodes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskGraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "macroTaskId" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "state" "RunState" NOT NULL DEFAULT 'queued',
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "roleCapability" TEXT NOT NULL,
    "complexity" TEXT NOT NULL,
    "dependsOn" TEXT[],
    "state" "RunTaskState" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "maxAttempts" INTEGER NOT NULL,
    "definitionOfReady" TEXT[],
    "definitionOfDone" TEXT[],
    "expectedArtifacts" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "causationId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunArtifact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_projectId_externalId_key" ON "Ticket"("projectId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Specification_ticketId_key" ON "Specification"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "Validation_ticketId_validatorId_kind_key" ON "Validation"("ticketId", "validatorId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRun_ticketId_key" ON "WorkflowRun"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_integrityHash_key" ON "AuditEvent"("integrityHash");

-- CreateIndex
CREATE INDEX "AuditEvent_occurredAt_idx" ON "AuditEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "WorkSession_projectId_state_idx" ON "WorkSession"("projectId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSession_projectId_idempotencyKey_key" ON "WorkSession"("projectId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MacroTask_projectId_sessionId_idx" ON "MacroTask"("projectId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MacroTask_sessionId_version_key" ON "MacroTask"("sessionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TaskGraph_macroTaskId_key" ON "TaskGraph"("macroTaskId");

-- CreateIndex
CREATE INDEX "TaskGraph_projectId_sessionId_idx" ON "TaskGraph"("projectId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionRun_correlationId_key" ON "ExecutionRun"("correlationId");

-- CreateIndex
CREATE INDEX "ExecutionRun_projectId_state_idx" ON "ExecutionRun"("projectId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionRun_projectId_idempotencyKey_key" ON "ExecutionRun"("projectId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RunTask_projectId_runId_state_idx" ON "RunTask"("projectId", "runId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "RunTask_runId_taskId_attempt_key" ON "RunTask"("runId", "taskId", "attempt");

-- CreateIndex
CREATE INDEX "RunEvent_projectId_sessionId_runId_idx" ON "RunEvent"("projectId", "sessionId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "RunEvent_runId_sequence_key" ON "RunEvent"("runId", "sequence");

-- CreateIndex
CREATE INDEX "RunArtifact_projectId_runId_idx" ON "RunArtifact"("projectId", "runId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Specification" ADD CONSTRAINT "Specification_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_validatorId_fkey" FOREIGN KEY ("validatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MacroTask" ADD CONSTRAINT "MacroTask_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskGraph" ADD CONSTRAINT "TaskGraph_macroTaskId_fkey" FOREIGN KEY ("macroTaskId") REFERENCES "MacroTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionRun" ADD CONSTRAINT "ExecutionRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionRun" ADD CONSTRAINT "ExecutionRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionRun" ADD CONSTRAINT "ExecutionRun_macroTaskId_fkey" FOREIGN KEY ("macroTaskId") REFERENCES "MacroTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionRun" ADD CONSTRAINT "ExecutionRun_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "TaskGraph"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunTask" ADD CONSTRAINT "RunTask_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ExecutionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunEvent" ADD CONSTRAINT "RunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ExecutionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunArtifact" ADD CONSTRAINT "RunArtifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ExecutionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
