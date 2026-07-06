-- CreateEnum
CREATE TYPE "CandidateEventType" AS ENUM ('IMPORTED', 'PUSHED_OUT', 'PULLED_IN', 'UPDATED');

-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('CSV', 'AIRTABLE', 'TYPEFORM');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('ACTIVE', 'ERROR', 'NEVER_SYNCED');

-- CreateTable
CREATE TABLE "CandidateEvent" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "CandidateEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL DEFAULT '',
    "criteria" JSONB NOT NULL,
    "targetOrgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "ConnectorType" NOT NULL,
    "label" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'NEVER_SYNCED',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateEvent_candidateId_idx" ON "CandidateEvent"("candidateId");

-- CreateIndex
CREATE INDEX "SavedSearch_orgId_idx" ON "SavedSearch"("orgId");

-- CreateIndex
CREATE INDEX "Connector_orgId_idx" ON "Connector"("orgId");

-- AddForeignKey
ALTER TABLE "CandidateEvent" ADD CONSTRAINT "CandidateEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
