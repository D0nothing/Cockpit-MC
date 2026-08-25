-- CreateEnum
CREATE TYPE "TaskDispatchState" AS ENUM ('queued', 'dispatched', 'running', 'completed', 'failed', 'cancelled');

-- AlterTable
ALTER TABLE "RunArtifact" ADD COLUMN     "dispatchId" TEXT;

-- AlterTable
ALTER TABLE "RunTask" ADD COLUMN     "ticketId" TEXT;

-- CreateTable
CREATE TABLE "TaskDispatch" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runTaskId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "state" "TaskDispatchState" NOT NULL DEFAULT 'queued',
    "idempotencyKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "branchName" TEXT,
    "externalReference" TEXT,
    "report" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskDispatch_projectId_state_idx" ON "TaskDispatch"("projectId", "state");

-- CreateIndex
CREATE INDEX "TaskDispatch_runTaskId_createdAt_idx" ON "TaskDispatch"("runTaskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDispatch_projectId_idempotencyKey_key" ON "TaskDispatch"("projectId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RunArtifact_dispatchId_idx" ON "RunArtifact"("dispatchId");

-- CreateIndex
CREATE INDEX "RunTask_ticketId_idx" ON "RunTask"("ticketId");

-- AddForeignKey
ALTER TABLE "RunTask" ADD CONSTRAINT "RunTask_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunArtifact" ADD CONSTRAINT "RunArtifact_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "TaskDispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDispatch" ADD CONSTRAINT "TaskDispatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDispatch" ADD CONSTRAINT "TaskDispatch_runTaskId_fkey" FOREIGN KEY ("runTaskId") REFERENCES "RunTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
