-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('quality', 'correction', 'risk', 'cost');

-- CreateEnum
CREATE TYPE "KnowledgeScope" AS ENUM ('project', 'common');

-- CreateEnum
CREATE TYPE "KnowledgeCandidateStatus" AS ENUM ('proposed', 'approved', 'rejected', 'promoted');

-- CreateEnum
CREATE TYPE "KnowledgeEntryStatus" AS ENUM ('active', 'revoked');

-- CreateTable
CREATE TABLE "FeedbackRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "FeedbackKind" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeedbackRecord_rating_check" CHECK ("rating" IN (-1, 0, 1))
);

-- CreateTable
CREATE TABLE "SessionMemoryItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "kind" "FeedbackKind" NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionMemoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeCandidate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "scope" "KnowledgeScope" NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "provenance" JSONB NOT NULL,
    "status" "KnowledgeCandidateStatus" NOT NULL DEFAULT 'proposed',
    "requiredApprovals" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeCandidate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeCandidate_approval_count_check" CHECK ("requiredApprovals" BETWEEN 1 AND 2),
    CONSTRAINT "KnowledgeCandidate_expiration_check" CHECK ("expiresAt" > "createdAt")
);

-- CreateTable
CREATE TABLE "KnowledgeDecision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "result" "ApprovalResult" NOT NULL,
    "reason" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "scope" "KnowledgeScope" NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "provenance" JSONB NOT NULL,
    "status" "KnowledgeEntryStatus" NOT NULL DEFAULT 'active',
    "supersedesId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeEntry_version_check" CHECK ("version" > 0)
);

-- CreateIndex
CREATE INDEX "FeedbackRecord_projectId_sessionId_createdAt_idx" ON "FeedbackRecord"("projectId", "sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackRecord_artifactId_idx" ON "FeedbackRecord"("artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackRecord_projectId_idempotencyKey_key" ON "FeedbackRecord"("projectId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMemoryItem_feedbackId_key" ON "SessionMemoryItem"("feedbackId");

-- CreateIndex
CREATE INDEX "SessionMemoryItem_projectId_sessionId_expiresAt_idx" ON "SessionMemoryItem"("projectId", "sessionId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeCandidate_feedbackId_key" ON "KnowledgeCandidate"("feedbackId");

-- CreateIndex
CREATE INDEX "KnowledgeCandidate_projectId_status_createdAt_idx" ON "KnowledgeCandidate"("projectId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeCandidate_projectId_key_contentHash_key" ON "KnowledgeCandidate"("projectId", "key", "contentHash");

-- CreateIndex
CREATE INDEX "KnowledgeDecision_projectId_candidateId_idx" ON "KnowledgeDecision"("projectId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDecision_candidateId_approverId_key" ON "KnowledgeDecision"("candidateId", "approverId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEntry_candidateId_key" ON "KnowledgeEntry"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEntry_supersedesId_key" ON "KnowledgeEntry"("supersedesId");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_projectId_status_updatedAt_idx" ON "KnowledgeEntry"("projectId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_scope_status_updatedAt_idx" ON "KnowledgeEntry"("scope", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEntry_namespace_key_version_key" ON "KnowledgeEntry"("namespace", "key", "version");

-- AddForeignKey
ALTER TABLE "FeedbackRecord" ADD CONSTRAINT "FeedbackRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRecord" ADD CONSTRAINT "FeedbackRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRecord" ADD CONSTRAINT "FeedbackRecord_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "RunArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMemoryItem" ADD CONSTRAINT "SessionMemoryItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMemoryItem" ADD CONSTRAINT "SessionMemoryItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMemoryItem" ADD CONSTRAINT "SessionMemoryItem_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "FeedbackRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCandidate" ADD CONSTRAINT "KnowledgeCandidate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCandidate" ADD CONSTRAINT "KnowledgeCandidate_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "FeedbackRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDecision" ADD CONSTRAINT "KnowledgeDecision_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "KnowledgeCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "KnowledgeCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "KnowledgeEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
