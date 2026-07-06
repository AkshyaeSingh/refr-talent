-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "description" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "IntegrationSuggestion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationSuggestion_orgId_idx" ON "IntegrationSuggestion"("orgId");

-- AddForeignKey
ALTER TABLE "IntegrationSuggestion" ADD CONSTRAINT "IntegrationSuggestion_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
