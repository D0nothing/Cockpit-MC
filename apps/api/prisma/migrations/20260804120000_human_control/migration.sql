-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'changes_requested', 'expired');

-- CreateEnum
CREATE TYPE "ApprovalResult" AS ENUM ('approved', 'rejected', 'changes_requested');

-- CreateEnum
CREATE TYPE "RunCommandType" AS ENUM ('pause', 'resume', 'cancel');

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "WorkSession" ADD COLUMN     "riskLevel" "RiskLevel" NOT NULL DEFAULT 'standard';

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "macroTaskId" TEXT NOT NULL,
    "targetVersion" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "requiredApprovals" INTEGER NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "result" "ApprovalResult" NOT NULL,
    "reason" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunCommand" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "type" "RunCommandType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "resultState" "RunState" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_macroTaskId_key" ON "ApprovalRequest"("macroTaskId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_projectId_status_idx" ON "ApprovalRequest"("projectId", "status");

-- CreateIndex
CREATE INDEX "ApprovalRecord_projectId_approvalRequestId_idx" ON "ApprovalRecord"("projectId", "approvalRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRecord_approvalRequestId_approverId_key" ON "ApprovalRecord"("approvalRequestId", "approverId");

-- CreateIndex
CREATE INDEX "RunCommand_projectId_runId_idx" ON "RunCommand"("projectId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "RunCommand_projectId_idempotencyKey_key" ON "RunCommand"("projectId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AuditEvent_projectId_occurredAt_idx" ON "AuditEvent"("projectId", "occurredAt");

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_macroTaskId_fkey" FOREIGN KEY ("macroTaskId") REFERENCES "MacroTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRecord" ADD CONSTRAINT "ApprovalRecord_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunCommand" ADD CONSTRAINT "RunCommand_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ExecutionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
