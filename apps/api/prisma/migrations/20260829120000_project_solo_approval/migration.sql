-- CreateEnum
CREATE TYPE "ProjectApprovalMode" AS ENUM ('FOUR_EYES', 'SOLO_DEV');

-- AlterTable
ALTER TABLE "Project"
ADD COLUMN "approvalMode" "ProjectApprovalMode" NOT NULL DEFAULT 'FOUR_EYES',
ADD COLUMN "approvalPolicyVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "soloDevExpiresAt" TIMESTAMP(3),
ADD COLUMN "approvalPolicyUpdatedBy" TEXT,
ADD COLUMN "approvalPolicyUpdatedAt" TIMESTAMP(3),
ADD COLUMN "approvalPolicyReason" TEXT;

-- AlterTable
ALTER TABLE "WorkflowRun"
ADD COLUMN "headCommitSha" TEXT,
ADD COLUMN "reconciledAt" TIMESTAMP(3),
ADD COLUMN "reconciledBy" TEXT;
