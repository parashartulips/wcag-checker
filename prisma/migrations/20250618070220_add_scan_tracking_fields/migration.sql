-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "impact" TEXT;

-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "analysisMethod" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "criticalIssues" INTEGER,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "minorIssues" INTEGER,
ADD COLUMN     "moderateIssues" INTEGER,
ADD COLUMN     "seriousIssues" INTEGER,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "totalIssues" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'pending';
