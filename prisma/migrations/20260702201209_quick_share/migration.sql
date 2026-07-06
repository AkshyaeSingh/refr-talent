-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "originLabel" TEXT;

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "askerOrgId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "criteriaText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "receivedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX "ShareLink_askerOrgId_idx" ON "ShareLink"("askerOrgId");

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_askerOrgId_fkey" FOREIGN KEY ("askerOrgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
