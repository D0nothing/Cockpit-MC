-- CreateEnum
CREATE TYPE "ExternalSyncState" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "ExternalTicketSync" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "state" "ExternalSyncState" NOT NULL DEFAULT 'pending',
    "payloadHash" TEXT NOT NULL,
    "remoteId" TEXT,
    "remoteUrl" TEXT,
    "failureCode" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalTicketSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalTicketSync_ticketId_provider_key" ON "ExternalTicketSync"("ticketId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalTicketSync_projectId_provider_remoteId_key" ON "ExternalTicketSync"("projectId", "provider", "remoteId");

-- CreateIndex
CREATE INDEX "ExternalTicketSync_projectId_state_updatedAt_idx" ON "ExternalTicketSync"("projectId", "state", "updatedAt");

-- AddForeignKey
ALTER TABLE "ExternalTicketSync" ADD CONSTRAINT "ExternalTicketSync_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTicketSync" ADD CONSTRAINT "ExternalTicketSync_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
