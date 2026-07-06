-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('CSV', 'AIRTABLE', 'TYPEFORM', 'NOTION', 'GOOGLE_FORM', 'MANUAL');

-- CreateEnum
CREATE TYPE "ShareType" AS ENUM ('PUSH', 'PULL');

-- CreateEnum
CREATE TYPE "ShareScope" AS ENUM ('SINGLE', 'LIST');

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgConnection" (
    "id" TEXT NOT NULL,
    "orgAId" TEXT NOT NULL,
    "orgBId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "OrgConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceType" "ImportSourceType" NOT NULL,
    "label" TEXT NOT NULL,
    "fieldMapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "skills" TEXT[],
    "roleInterest" TEXT[],
    "experienceLevel" TEXT,
    "location" TEXT,
    "remoteOk" BOOLEAN NOT NULL DEFAULT false,
    "linkedinUrl" TEXT,
    "resumeUrl" TEXT,
    "notes" TEXT,
    "rawFields" JSONB,
    "originOrgId" TEXT,
    "originCandidateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareAction" (
    "id" TEXT NOT NULL,
    "type" "ShareType" NOT NULL,
    "scope" "ShareScope" NOT NULL,
    "fromOrgId" TEXT NOT NULL,
    "toOrgId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "candidateId" TEXT,
    "filterCriteria" JSONB,
    "candidateCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Org_slug_key" ON "Org"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OrgConnection_orgAId_orgBId_key" ON "OrgConnection"("orgAId", "orgBId");

-- CreateIndex
CREATE INDEX "Candidate_orgId_idx" ON "Candidate"("orgId");

-- CreateIndex
CREATE INDEX "Candidate_originCandidateId_idx" ON "Candidate"("originCandidateId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgConnection" ADD CONSTRAINT "OrgConnection_orgAId_fkey" FOREIGN KEY ("orgAId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgConnection" ADD CONSTRAINT "OrgConnection_orgBId_fkey" FOREIGN KEY ("orgBId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_originOrgId_fkey" FOREIGN KEY ("originOrgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_originCandidateId_fkey" FOREIGN KEY ("originCandidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareAction" ADD CONSTRAINT "ShareAction_fromOrgId_fkey" FOREIGN KEY ("fromOrgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareAction" ADD CONSTRAINT "ShareAction_toOrgId_fkey" FOREIGN KEY ("toOrgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareAction" ADD CONSTRAINT "ShareAction_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
