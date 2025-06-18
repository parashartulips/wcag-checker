'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { ArrowLeft, Copy, Download, Calendar, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { copyTableToClipboard, copyUrlToClipboard } from '@/lib/copyclipboard'

interface Issue {
  id: string
  type: string
  impact: string
  description: string
  help?: string
  helpUrl?: string
  target?: string
  html?: string
  tags: string[]
  createdAt: string
}

interface Scan {
  id: string
  url: string
  title?: string
  status: string
  totalIssues: number
  createdAt: string
  updatedAt: string
  issues: Issue[]
}

interface Project {
  id: string
  name: string
  url: string
  description?: string
  lastScanned?: string
  totalIssues: number
}

interface ReportsData {
  project: Project
  scans: Scan[]
}

export default function ProjectReports() {
  const params = useParams()
  const router = useRouter()
  const tableRef = useRef<HTMLTableElement>(null)
  const [data, setData] = useState<ReportsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token')
    if (!savedToken) {
      router.push('/')
      return
    }
    setToken(savedToken)
    loadReports(savedToken)
  }, [params.id, router])

  async function loadReports(authToken: string) {
    try {
      const response = await fetch(`/api/projects/${params.id}/scans`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/')
          return
        }
        throw new Error('Failed to load reports')
      }

      const reportsData = await response.json()
      setData(reportsData)
    } catch (error) {
      console.error('Load reports error:', error)
      toast.error('Failed to load reports')
    } finally {
      setIsLoading(false)
    }
  }

  async function copyTableData() {
    if (tableRef.current) {
      const success = await copyTableToClipboard(tableRef.current)
      if (success) {
        toast.success('Table data copied to clipboard!')
      } else {
        toast.error('Failed to copy table data')
      }
    }
  }

  async function copyProjectUrl() {
    if (data?.project.url) {
      const success = await copyUrlToClipboard(data.project.url)
      if (success) {
        toast.success('Project URL copied to clipboard!')
      } else {
        toast.error('Failed to copy URL')
      }
    }
  }

  function getImpactColor(impact: string) {
    switch (impact.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'serious': return 'bg-orange-100 text-orange-800'
      case 'moderate': return 'bg-yellow-100 text-yellow-800'
      case 'minor': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />
      default: return <AlertTriangle className="w-4 h-4 text-yellow-500" />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading reports...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="text-center p-8">
          <CardContent>
            <h2 className="text-xl font-semibold mb-2">No data found</h2>
            <p className="text-gray-600 mb-4">Unable to load project reports</p>
            <Button onClick={() => router.push('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const latestScan = data.scans[0]
  const allIssues = latestScan?.issues || []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button variant="ghost" onClick={() => router.push('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={copyProjectUrl}>
                <Copy className="w-4 h-4 mr-2" />
                Copy URL
              </Button>
              <Button variant="outline" onClick={copyTableData}>
                <Download className="w-4 h-4 mr-2" />
                Copy Table
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{data.project.name}</h1>
          <p className="text-gray-600 mt-1">{data.project.url}</p>
          {data.project.description && (
            <p className="text-gray-600 mt-2">{data.project.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.project.totalIssues}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Last Scanned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.project.lastScanned 
                  ? new Date(data.project.lastScanned).toLocaleDateString()
                  : 'Never'
                }
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.scans.length}</div>
            </CardContent>
          </Card>
        </div>

        {latestScan && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Latest Scan Results</CardTitle>
                  <CardDescription className="flex items-center mt-1">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(latestScan.createdAt).toLocaleString()}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(latestScan.status)}
                  <Badge variant={latestScan.status === 'completed' ? 'default' : 'destructive'}>
                    {latestScan.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allIssues.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table ref={tableRef}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Impact</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead>Help</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allIssues.map((issue) => (
                        <TableRow key={issue.id}>
                          <TableCell className="font-medium">{issue.type}</TableCell>
                          <TableCell>
                            <Badge className={getImpactColor(issue.impact)}>
                              {issue.impact}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="truncate" title={issue.description}>
                              {issue.description}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate font-mono text-sm" title={issue.target}>
                              {issue.target}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {issue.tags.slice(0, 3).map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {issue.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{issue.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {issue.helpUrl ? (
                              <a 
                                href={issue.helpUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Learn more
                              </a>
                            ) : (
                              <span className="text-gray-400 text-sm">No help available</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Issues Found</h3>
                  <p className="text-gray-600">Great! Your website appears to be accessible.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {data.scans.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Scan History</CardTitle>
              <CardDescription>Previous scans for this project</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.scans.slice(1).map((scan) => (
                  <div key={scan.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(scan.status)}
                        <span className="font-medium">{scan.title}</span>
                        <Badge variant={scan.status === 'completed' ? 'default' : 'destructive'}>
                          {scan.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(scan.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{scan.totalIssues} issues</div>
                      <div className="text-sm text-gray-600">{scan.issues.length} details</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
} 