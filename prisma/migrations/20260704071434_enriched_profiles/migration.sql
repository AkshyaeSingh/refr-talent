-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "audienceTier" TEXT,
ADD COLUMN     "consentToShare" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "credentials" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "enrichedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "headline" TEXT,
ADD COLUMN     "links" JSONB,
ADD COLUMN     "profileExtractedAt" TIMESTAMP(3),
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "topics" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "logoUrl" TEXT;
