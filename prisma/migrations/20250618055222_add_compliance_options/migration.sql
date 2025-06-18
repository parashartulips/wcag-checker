/*
  Warnings:

  - You are about to drop the `Result` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ScanToUrl` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[url,projectId]` on the table `Url` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `complianceOptions` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `urlId` to the `Scan` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Result" DROP CONSTRAINT "Result_scanId_fkey";

-- DropForeignKey
ALTER TABLE "Scan" DROP CONSTRAINT "Scan_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Url" DROP CONSTRAINT "Url_projectId_fkey";

-- DropForeignKey
ALTER TABLE "_ScanToUrl" DROP CONSTRAINT "_ScanToUrl_A_fkey";

-- DropForeignKey
ALTER TABLE "_ScanToUrl" DROP CONSTRAINT "_ScanToUrl_B_fkey";

-- DropIndex
DROP INDEX "Scan_projectId_idx";

-- DropIndex
DROP INDEX "Url_projectId_idx";

-- DropIndex
DROP INDEX "Url_url_key";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "complianceOptions" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "urlId" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'pending';

-- DropTable
DROP TABLE "Result";

-- DropTable
DROP TABLE "_ScanToUrl";

-- CreateTable
CREATE TABLE "ScanResult" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "screenshots" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Url_url_projectId_key" ON "Url"("url", "projectId");

-- AddForeignKey
ALTER TABLE "Url" ADD CONSTRAINT "Url_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_urlId_fkey" FOREIGN KEY ("urlId") REFERENCES "Url"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanResult" ADD CONSTRAINT "ScanResult_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
