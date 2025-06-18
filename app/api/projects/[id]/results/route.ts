import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "10")
    const sortBy = searchParams.get("sortBy") || "severity"
    const search = searchParams.get("search") || ""
    const severityFilters = searchParams.get("severityFilters")?.split(",") || []
    const complianceFilters = searchParams.get("complianceFilters")?.split(",") || []

    // Get all completed scans for this project
    const scans = await prisma.scan.findMany({
      where: {
        projectId: id,
        status: 'completed'
      },
      include: {
        results: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (scans.length === 0) {
      return NextResponse.json({
        results: [],
        summary: { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 },
        total: 0,
        page,
        pageSize,
        totalPages: 0
      })
    }

    // Combine all results from all scans
    const allResults = scans.flatMap(scan => scan.results)

    // Create deduplication map based on (url + message + element + severity)
    const deduplicationMap = new Map<string, any>()
    
    allResults.forEach(result => {
      const key = `${result.url}|${result.message}|${result.element || ''}|${result.severity}`
      
      // Keep the most recent result for each unique combination
      if (!deduplicationMap.has(key) || 
          new Date(result.createdAt) > new Date(deduplicationMap.get(key).createdAt)) {
        deduplicationMap.set(key, result)
      }
    })

    // Convert back to array
    let uniqueResults = Array.from(deduplicationMap.values())

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase()
      uniqueResults = uniqueResults.filter(result =>
        result.message.toLowerCase().includes(searchLower) ||
        result.url.toLowerCase().includes(searchLower) ||
        (result.element && result.element.toLowerCase().includes(searchLower)) ||
        (result.help && result.help.toLowerCase().includes(searchLower))
      )
    }

    if (severityFilters.length > 0) {
      uniqueResults = uniqueResults.filter(result =>
        severityFilters.includes(result.severity)
      )
    }

    if (complianceFilters.length > 0) {
      uniqueResults = uniqueResults.filter(result =>
        result.tags.some((tag: string) => complianceFilters.includes(tag))
      )
    }

    // Apply sorting
    uniqueResults.sort((a, b) => {
      switch (sortBy) {
        case 'severity':
          const severityOrder = { critical: 4, serious: 3, moderate: 2, minor: 1 }
          const aSeverity = severityOrder[a.severity as keyof typeof severityOrder] || 0
          const bSeverity = severityOrder[b.severity as keyof typeof severityOrder] || 0
          if (aSeverity !== bSeverity) return bSeverity - aSeverity
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'url':
          return a.url.localeCompare(b.url)
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

    // Calculate summary from filtered results
    const summary = {
      critical: uniqueResults.filter(r => r.severity === 'critical').length,
      serious: uniqueResults.filter(r => r.severity === 'serious').length,
      moderate: uniqueResults.filter(r => r.severity === 'moderate').length,
      minor: uniqueResults.filter(r => r.severity === 'minor').length,
      total: uniqueResults.length
    }

    // Apply pagination
    const totalResults = uniqueResults.length
    const totalPages = Math.ceil(totalResults / pageSize)
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedResults = uniqueResults.slice(startIndex, endIndex)

    // Add scan information to each result
    const resultsWithScanInfo = paginatedResults.map(result => {
      const scan = scans.find(s => s.results.some(r => r.id === result.id))
      return {
        ...result,
        scan: scan ? {
          id: scan.id,
          createdAt: scan.createdAt,
          project: { id: scan.projectId }
        } : null
      }
    })

    return NextResponse.json({
      results: resultsWithScanInfo,
      summary,
      total: totalResults,
      page,
      pageSize,
      totalPages
    })

  } catch (error) {
    console.error("Error getting project results:", error)
    return NextResponse.json(
      { error: "Failed to get project results" },
      { status: 500 }
    )
  }
} 