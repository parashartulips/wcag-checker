import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Function to calculate estimated fix time based on issue count and severity
function calculateEstimatedTime(
  critical: number,
  serious: number,
  moderate: number,
  minor: number
): string {
  // Base time in minutes by severity
  const timeInMinutes = 
    critical * 120 +  // 2 hours each
    serious * 90 +    // 1.5 hours each
    moderate * 45 +   // 45 minutes each
    minor * 15        // 15 minutes each
  
  // Convert to readable format
  if (timeInMinutes < 60) {
    return `${Math.round(timeInMinutes)}m`
  } else if (timeInMinutes < 480) { // Less than 8 hours
    const hours = Math.floor(timeInMinutes / 60)
    const minutes = Math.round(timeInMinutes % 60)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  } else {
    const days = Math.floor(timeInMinutes / 480) // 8 hours per day
    const remainingHours = Math.floor((timeInMinutes % 480) / 60)
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }
}

export async function GET() {
  try {
    // Get all projects with their latest completed scans
    const projects = await prisma.project.findMany({
      include: {
        scans: {
          where: {
            status: 'completed'
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1 // Get only the latest completed scan per project
        }
      }
    })

    // Calculate overall statistics from scan summary fields
    let totalIssues = 0
    let criticalIssues = 0
    let seriousIssues = 0
    let moderateIssues = 0
    let minorIssues = 0
    let totalScans = 0
    let lastScanDate: Date | null = null

    const projectStats = projects.map(project => {
      const latestScan = project.scans[0] // Get the latest completed scan
      
      const projectIssues = {
        critical: latestScan?.criticalIssues || 0,
        serious: latestScan?.seriousIssues || 0,
        moderate: latestScan?.moderateIssues || 0,
        minor: latestScan?.minorIssues || 0,
        total: latestScan?.totalIssues || 0
      }

      if (latestScan) {
        totalScans++
        
        // Add to overall totals
        criticalIssues += projectIssues.critical
        seriousIssues += projectIssues.serious
        moderateIssues += projectIssues.moderate
        minorIssues += projectIssues.minor
        totalIssues += projectIssues.total
        
        if (!lastScanDate || latestScan.createdAt > lastScanDate) {
          lastScanDate = latestScan.createdAt
        }
      }

      return {
        id: project.id,
        name: project.name,
        totalIssues: projectIssues.total,
        criticalIssues: projectIssues.critical,
        seriousIssues: projectIssues.serious,
        moderateIssues: projectIssues.moderate,
        minorIssues: projectIssues.minor,
        estimatedTime: calculateEstimatedTime(
          projectIssues.critical,
          projectIssues.serious,
          projectIssues.moderate,
          projectIssues.minor
        ),
        lastScan: latestScan ? latestScan.createdAt.toISOString() : null,
        scanStatus: latestScan?.status || 'no_scans'
      }
    })

    const overview = {
      totalProjects: projects.length,
      totalScans,
      totalIssues,
      criticalIssues,
      seriousIssues,
      moderateIssues,
      minorIssues,
      totalEstimatedTime: calculateEstimatedTime(
        criticalIssues,
        seriousIssues,
        moderateIssues,
        minorIssues
      ),
      averageIssuesPerProject: projects.length > 0 ? Math.round(totalIssues / projects.length) : 0,
      lastScanDate: lastScanDate ? (lastScanDate as Date).toISOString() : null
    }

    return NextResponse.json({
      overview,
      projects: projectStats.sort((a, b) => b.totalIssues - a.totalIssues) // Sort by most issues first
    })

  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
} 