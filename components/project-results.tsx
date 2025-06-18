"use client"

import { useState, useEffect, useCallback } from "react"
import { ResultsTable } from "@/components/results-table"

interface Project {
  id: string
  name: string
  urls: { url: string }[]
  scans: {
    id: string
    createdAt: Date
    results: {
      id: string
      url: string
      message: string
      element: string | null
      severity: string
      help: string | null
      tags: string[]
      elementPath: string | null
      details: any
      createdAt: Date
      updatedAt: Date
    }[]
  }[]
}

interface ProjectResultsProps {
  project: Project
}

// Function to estimate fix time based on issue severity and type
function estimateFixTime(result: any): string {
  const { severity, message, tags } = result
  
  // Base time in minutes by severity
  const baseTimeMinutes: { [key: string]: number } = {
    critical: 60, // 2 hours
    serious: 30,   // 1.5 hours
    moderate: 15,  // 45 minutes
    minor: 5      // 15 minutes
  }
  
  let time = baseTimeMinutes[severity?.toLowerCase()] || 30
  
  // Adjust based on issue type
  if (message?.toLowerCase().includes('color contrast') || 
      message?.toLowerCase().includes('contrast')) {
    time *= 0.5 // Color contrast is usually quick CSS fix
  } else if (message?.toLowerCase().includes('alt') || 
             message?.toLowerCase().includes('alternative text')) {
    time *= 0.3 // Alt text is very quick to add
  } else if (message?.toLowerCase().includes('heading') || 
             message?.toLowerCase().includes('structure')) {
    time *= 1.5 // Structural changes take longer
  } else if (message?.toLowerCase().includes('keyboard') || 
             message?.toLowerCase().includes('focus')) {
    time *= 2 // Keyboard accessibility can be complex
  } else if (message?.toLowerCase().includes('aria') || 
             message?.toLowerCase().includes('role')) {
    time *= 1.2 // ARIA attributes are moderately complex
  }
  
  // Adjust based on compliance level (more strict = more time)
  if (tags?.includes('wcag2aaa')) {
    time *= 1.3
  } else if (tags?.includes('section508')) {
    time *= 1.1
  }
  
  // Convert to readable format
  if (time < 60) {
    return `${Math.round(time)}m`
  } else if (time < 480) { // Less than 8 hours
    const hours = Math.floor(time / 60)
    const minutes = Math.round(time % 60)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  } else {
    const days = Math.floor(time / 480) // 8 hours per day
    const remainingHours = Math.floor((time % 480) / 60)
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }
}

export function ProjectResults({ project }: ProjectResultsProps) {
  const [results, setResults] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [sortBy, setSortBy] = useState("severity")
  const [searchQuery, setSearchQuery] = useState("")
  const [severityFilters, setSeverityFilters] = useState<string[]>([])
  const [complianceFilters, setComplianceFilters] = useState<string[]>([])
  const [isPolling, setIsPolling] = useState(false)

  const fetchResults = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        search: searchQuery,
        ...(severityFilters.length > 0 && { severityFilters: severityFilters.join(",") }),
        ...(complianceFilters.length > 0 && { complianceFilters: complianceFilters.join(",") })
      })
      
      // Use the new combined project results API
      const response = await fetch(`/api/projects/${project.id}/results?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.statusText}`)
      }
      
      const data = await response.json()

      // Add estimated fix time to each result
      const resultsWithTime = data.results.map((result: any) => ({
        ...result,
        estimatedFixTime: estimateFixTime(result)
      }))

      setResults(resultsWithTime)
      setSummary(data.summary)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error("Error fetching results:", error)
      setResults([])
      setSummary({
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        total: 0
      })
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [project.id, page, sortBy, searchQuery, severityFilters, complianceFilters, pageSize])

  // Check for in-progress scans and start polling if needed
  const checkForInProgressScans = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}`)
      if (!response.ok) return false
      
      const projectData = await response.json()
      const hasInProgressScans = projectData.scans?.some((scan: any) => 
        scan.status === 'pending' || scan.status === 'in_progress'
      )
      
      return hasInProgressScans
    } catch (error) {
      console.error("Error checking scan status:", error)
      return false
    }
  }, [project.id])

  // Polling effect for in-progress scans
  useEffect(() => {
    let pollInterval: NodeJS.Timeout

    const startPolling = async () => {
      const hasInProgressScans = await checkForInProgressScans()
      
      if (hasInProgressScans && !isPolling) {
        console.log("Starting polling for in-progress scans...")
        setIsPolling(true)
        
        pollInterval = setInterval(async () => {
          const stillInProgress = await checkForInProgressScans()
          
          if (stillInProgress) {
            // Refresh results while scanning
            await fetchResults()
          } else {
            // Scans completed, stop polling and do final refresh
            console.log("Scans completed, stopping polling")
            setIsPolling(false)
            await fetchResults()
            clearInterval(pollInterval)
          }
        }, 3000) // Poll every 3 seconds
      }
    }

    startPolling()

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [checkForInProgressScans, fetchResults, isPolling])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  // Show message if no scans exist
  if (!project.scans || project.scans.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No scans available for this project.</p>
        <p className="text-sm text-gray-400 mt-2">Run a scan to see accessibility results.</p>
      </div>
    )
  }

  // Show polling indicator
  if (isPolling) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-blue-700 font-medium">Scan in progress...</span>
          </div>
          <p className="text-blue-600 text-sm mt-1">Results will automatically refresh when scanning completes.</p>
        </div>
        <ResultsTable
          results={results}
          summary={summary}
          loading={loading}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          sortBy={sortBy}
          searchQuery={searchQuery}
          severityFilters={severityFilters}
          complianceFilters={complianceFilters}
          projectId={project.id}
          onPageChange={setPage}
          onSortChange={setSortBy}
          onSearchChange={setSearchQuery}
          onSeverityFilterChange={setSeverityFilters}
          onComplianceFilterChange={setComplianceFilters}
        />
      </div>
    )
  }

  return (
    <ResultsTable
      results={results}
      summary={summary}
      loading={loading}
      page={page}
      pageSize={pageSize}
      totalPages={totalPages}
      sortBy={sortBy}
      searchQuery={searchQuery}
      severityFilters={severityFilters}
      complianceFilters={complianceFilters}
      projectId={project.id}
      onPageChange={setPage}
      onSortChange={setSortBy}
      onSearchChange={setSearchQuery}
      onSeverityFilterChange={setSeverityFilters}
      onComplianceFilterChange={setComplianceFilters}
    />
  )
} 