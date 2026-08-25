-- CreateEnum
CREATE TYPE "EpicStatus" AS ENUM ('planned', 'in_progress', 'review', 'done', 'blocked', 'cancelled');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "nextTicketNumber" INTEGER NOT NULL DEFAULT 1000;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "acceptanceCriteria" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "capability" TEXT NOT NULL DEFAULT 'engineering',
ADD COLUMN     "complexity" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN     "definitionOfDone" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dependsOn" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "epicId" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'implementation',
ADD COLUMN     "plannerKey" TEXT,
ADD COLUMN     "sourceSessionId" TEXT;

-- CreateTable
CREATE TABLE "Epic" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "expectedOutcome" TEXT NOT NULL,
    "acceptanceCriteria" TEXT[],
    "status" "EpicStatus" NOT NULL DEFAULT 'planned',
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Epic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Epic_projectId_status_idx" ON "Epic"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Epic_sessionId_key_key" ON "Epic"("sessionId", "key");

-- CreateIndex
CREATE INDEX "Ticket_projectId_epicId_status_idx" ON "Ticket"("projectId", "epicId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_sourceSessionId_plannerKey_key" ON "Ticket"("sourceSessionId", "plannerKey");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "Epic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "WorkSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Epic" ADD CONSTRAINT "Epic_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Epic" ADD CONSTRAINT "Epic_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
