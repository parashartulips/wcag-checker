/*
  Warnings:

  - You are about to drop the column `urlId` on the `Scan` table. All the data in the column will be lost.
  - You are about to drop the `ScanResult` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[url]` on the table `Url` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `url` to the `Scan` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Scan" DROP CONSTRAINT "Scan_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Scan" DROP CONSTRAINT "Scan_urlId_fkey";

-- DropForeignKey
ALTER TABLE "ScanResult" DROP CONSTRAINT "ScanResult_scanId_fkey";

-- DropForeignKey
ALTER TABLE "Url" DROP CONSTRAINT "Url_projectId_fkey";

-- DropIndex
DROP INDEX "Url_url_projectId_key";

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "complianceOptions" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Scan" DROP COLUMN "urlId",
ADD COLUMN     "url" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'completed';

-- DropTable
DROP TABLE "ScanResult";

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "element" TEXT,
    "severity" TEXT NOT NULL,
    "help" TEXT,
    "tags" TEXT[],
    "elementPath" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Result_scanId_idx" ON "Result"("scanId");

-- CreateIndex
CREATE INDEX "Scan_projectId_idx" ON "Scan"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Url_url_key" ON "Url"("url");

-- CreateIndex
CREATE INDEX "Url_projectId_idx" ON "Url"("projectId");

-- AddForeignKey
ALTER TABLE "Url" ADD CONSTRAINT "Url_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
