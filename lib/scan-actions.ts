import { prisma } from './db'
import type { AccessibilityResult } from './types'

export async function createScan(projectId: string, url: string) {
  return prisma.scan.create({
    data: {
      projectId,
      url,
      status: "pending"
    }
  })
}

export async function getScanResults(
  scanId: string,
  page: number = 1,
  pageSize: number = 10,
  sortBy: string = "severity",
  searchQuery: string = "",
  severityFilters: string[] = [],
  complianceFilters: string[] = []
) {
  const skip = (page - 1) * pageSize;
  
  const where = {
    scanId,
    ...(searchQuery && {
      OR: [
        { message: { contains: searchQuery } },
        { url: { contains: searchQuery } }
      ]
    }),
    ...(severityFilters.length > 0 && {
      severity: { in: severityFilters }
    })
  };

  const [results, total] = await Promise.all([
    prisma.result.findMany({
      where,
      orderBy: { [sortBy]: 'desc' },
      skip,
      take: pageSize
    }),
    prisma.result.count({ where })
  ]);

  // Calculate summary
  const summary = await prisma.result.groupBy({
    by: ['severity'],
    where: { scanId },
    _count: true
  });

  return {
    results,
    total,
    summary: {
      critical: summary.find(s => s.severity === 'critical')?._count || 0,
      serious: summary.find(s => s.severity === 'serious')?._count || 0,
      moderate: summary.find(s => s.severity === 'moderate')?._count || 0,
      minor: summary.find(s => s.severity === 'minor')?._count || 0,
      total: total
    }
  };
}

export async function getScan(scanId: string) {
  return prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      results: true
    }
  })
}

export async function updateScanStatus(scanId: string, status: string) {
  return prisma.scan.update({
    where: { id: scanId },
    data: { status }
  })
}

export async function addScanResults(scanId: string, results: AccessibilityResult[]) {
  const resultData = results.map(result => ({
    scanId,
    url: result.url,
    message: result.message,
    element: result.element,
    severity: result.severity,
    help: result.help,
    tags: result.tags,
    elementPath: result.elementPath,
    details: result.details
  }))

  return prisma.result.createMany({
    data: resultData
  })
} 