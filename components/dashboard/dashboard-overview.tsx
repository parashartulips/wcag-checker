"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle, Clock, FileText, TrendingUp } from 'lucide-react'

interface DashboardStats {
  totalProjects: number
  totalScans: number
  totalIssues: number
  criticalIssues: number
  seriousIssues: number
  moderateIssues: number
  minorIssues: number
  totalEstimatedTime: string
  averageIssuesPerProject: number
  lastScanDate: string | null
}

interface ProjectWithStats {
  id: string
  name: string
  totalIssues: number
  criticalIssues: number
  seriousIssues: number
  moderateIssues: number
  minorIssues: number
  estimatedTime: string
  lastScan: string | null
}

// Function to estimate fix time based on issue count and severity
function calculateTotalEstimatedTime(
  critical: number,
  serious: number,
  moderate: number,
  minor: number
): string {
  // Base time in minutes by severity
  const timeInMinutes = 
    critical * 60 +  // 2 hours each
    serious * 30 +    // 1.5 hours each
    moderate * 15 +   // 45 minutes each
    minor * 5        // 15 minutes each
  
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

export function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [projectStats, setProjectStats] = useState<ProjectWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/dashboard/stats')
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats')
      }
      
      const data = await response.json()
      setStats(data.overview)
      setProjectStats(data.projects)
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700 font-medium">Error loading dashboard</span>
        </div>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalScans} total scans
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalIssues}</div>
            <p className="text-xs text-muted-foreground">
              Avg {stats.averageIssuesPerProject.toFixed(1)} per project
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Est. Fix Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEstimatedTime}</div>
            <p className="text-xs text-muted-foreground">
              Total estimated work
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.criticalIssues}</div>
            <p className="text-xs text-muted-foreground">
              Need immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Severity Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Issue Severity Breakdown</CardTitle>
          <CardDescription>
            Distribution of accessibility issues across all projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <Badge className="bg-red-500 hover:bg-red-600 text-white mb-2">
                Critical
              </Badge>
              <div className="text-2xl font-bold text-red-600">{stats.criticalIssues}</div>
              <div className="text-sm text-gray-500">
                ~{calculateTotalEstimatedTime(stats.criticalIssues, 0, 0, 0)}
              </div>
            </div>
            <div className="text-center">
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white mb-2">
                Serious
              </Badge>
              <div className="text-2xl font-bold text-orange-600">{stats.seriousIssues}</div>
              <div className="text-sm text-gray-500">
                ~{calculateTotalEstimatedTime(0, stats.seriousIssues, 0, 0)}
              </div>
            </div>
            <div className="text-center">
              <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white mb-2">
                Moderate
              </Badge>
              <div className="text-2xl font-bold text-yellow-600">{stats.moderateIssues}</div>
              <div className="text-sm text-gray-500">
                ~{calculateTotalEstimatedTime(0, 0, stats.moderateIssues, 0)}
              </div>
            </div>
            <div className="text-center">
              <Badge className="bg-blue-500 hover:bg-blue-600 text-white mb-2">
                Minor
              </Badge>
              <div className="text-2xl font-bold text-blue-600">{stats.minorIssues}</div>
              <div className="text-sm text-gray-500">
                ~{calculateTotalEstimatedTime(0, 0, 0, stats.minorIssues)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Project Overview</CardTitle>
          <CardDescription>
            Individual project statistics and estimated fix times
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projectStats.map((project) => (
              <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{project.name}</h4>
                  <div className="flex gap-2 mt-2">
                    {project.criticalIssues > 0 && (
                      <Badge className="bg-red-500 text-white text-xs">
                        {project.criticalIssues} Critical
                      </Badge>
                    )}
                    {project.seriousIssues > 0 && (
                      <Badge className="bg-orange-500 text-white text-xs">
                        {project.seriousIssues} Serious
                      </Badge>
                    )}
                    {project.moderateIssues > 0 && (
                      <Badge className="bg-yellow-500 text-white text-xs">
                        {project.moderateIssues} Moderate
                      </Badge>
                    )}
                    {project.minorIssues > 0 && (
                      <Badge className="bg-blue-500 text-white text-xs">
                        {project.minorIssues} Minor
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{project.totalIssues}</div>
                  <div className="text-sm text-gray-500">issues</div>
                  <div className="text-sm font-medium text-blue-600 mt-1">
                    Est. {project.estimatedTime}
                  </div>
                  {project.lastScan && (
                    <div className="text-xs text-gray-400 mt-1">
                      Last scan: {new Date(project.lastScan).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {projectStats.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No projects found. Create a project to get started.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 