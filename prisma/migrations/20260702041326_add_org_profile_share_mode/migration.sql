-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "focusAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "orgType" TEXT;

-- AlterTable
ALTER TABLE "OrgConnection" ADD COLUMN     "shareMode" TEXT NOT NULL DEFAULT 'MANUAL';
