import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Download, Search, Loader2, ExternalLink, Filter, X, Code, Copy, Image, Eye } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import type { AccessibilityResult, AccessibilitySummary } from '@/lib/types'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useState } from 'react'

interface ResultsTableProps {
  results: AccessibilityResult[]
  summary: AccessibilitySummary | null
  loading: boolean
  page: number
  pageSize: number
  totalPages: number
  sortBy: string
  searchQuery: string
  severityFilters: string[]
  complianceFilters: string[]
  projectId?: string
  scanId?: string
  onPageChange: (page: number) => void
  onSortChange: (sortBy: string) => void
  onSearchChange: (query: string) => void
  onSeverityFilterChange: (filters: string[]) => void
  onComplianceFilterChange: (filters: string[]) => void
}

export function ResultsTable({
  results,
  summary,
  loading,
  page,
  pageSize,
  totalPages,
  sortBy,
  searchQuery,
  severityFilters,
  complianceFilters,
  projectId,
  scanId,
  onPageChange,
  onSortChange,
  onSearchChange,
  onSeverityFilterChange,
  onComplianceFilterChange,
}: ResultsTableProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [issueScreenshot, setIssueScreenshot] = useState<string | null>(null)
  const [loadingScreenshot, setLoadingScreenshot] = useState(false)
  const [loadingImage, setLoadingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [screenshotError, setScreenshotError] = useState<string | null>(null)
  const [selectedResult, setSelectedResult] = useState<AccessibilityResult | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf' | null>(null)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportError, setExportError] = useState<string | null>(null)

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "bg-red-500 hover:bg-red-600"
      case "serious":
        return "bg-orange-500 hover:bg-orange-600"
      case "moderate":
        return "bg-yellow-500 hover:bg-yellow-600"
      case "minor":
        return "bg-blue-500 hover:bg-blue-600"
      default:
        return "bg-gray-500 hover:bg-gray-600"
    }
  }

  const getTagColor = (tag: string) => {
    if (tag.includes("wcag2aaa")) {
      return "bg-purple-500 hover:bg-purple-600"
    } else if (tag.includes("wcag2aa")) {
      return "bg-green-500 hover:bg-green-600"
    } else if (tag.includes("wcag2a")) {
      return "bg-blue-500 hover:bg-blue-600"
    } else if (tag.includes("section508")) {
      return "bg-orange-500 hover:bg-orange-600"
    } else if (tag.includes("best-practice")) {
      return "bg-teal-500 hover:bg-teal-600"
    } else if (tag.includes("experimental")) {
      return "bg-gray-500 hover:bg-gray-600"
    }
    return "bg-gray-500 hover:bg-gray-600"
  }

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(true)
    setExportFormat(format)
    setExportProgress(0)
    setExportError(null)

    try {
      // Create a query string with all current filters
      const queryParams = new URLSearchParams()
      queryParams.append("format", format)
      if (searchQuery) queryParams.append("search", searchQuery)
      if (sortBy) queryParams.append("sortBy", sortBy)
      if (projectId) queryParams.append("projectId", projectId)
      if (scanId) queryParams.append("scanId", scanId)
      if (severityFilters.length > 0) {
        severityFilters.forEach((filter) => queryParams.append("severityFilters", filter))
      }
      if (complianceFilters.length > 0) {
        complianceFilters.forEach((filter) => queryParams.append("complianceFilters", filter))
      }

      setExportProgress(20)

      const response = await fetch(`/api/export?${queryParams.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Export failed")
      }
      console.log(response,"Response for export")
      setExportProgress(60)

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      console.log(link,"Link for export")
      link.download = `accessibility-results-${new Date().toISOString().split("T")[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setExportProgress(100)
      toast({
        title: "Success",
        description: `Results exported as ${format.toUpperCase()} successfully`,
      })
    } catch (error) {
      console.error("Export error:", error)
      setExportError(error instanceof Error ? error.message : "Export failed")
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export results",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
      setTimeout(() => {
        setExportProgress(0)
        setExportFormat(null)
      }, 2000)
    }
  }

  const handleCopyTable = async () => {
    try {
      const rows: string[] = []

      // Add headers
      rows.push(["URL", "Issue", "Severity", "Est. Fix Time", "Element", "Compliance"].join("\t"))

      // Add data rows
      results.forEach(result => {
        rows.push([
          result.url,
          result.message,
          result.severity,
          (result as any).estimatedFixTime || "N/A",
          result.element || "",
          result.tags?.join(", ") || ""
        ].join("\t"))
      })

      await navigator.clipboard.writeText(rows.join("\n"))

      toast({
        title: "Success",
        description: "Table data copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy table data",
        variant: "destructive",
      })
    }
  }

  const formatIssuePrompt = (result: AccessibilityResult) => {
    return `Fix this accessibility issue:

Issue: ${result.message}
Element: ${result.element}
Severity: ${result.severity}
URL: ${result.url}
Help: ${result.help}
Tags: ${result.tags?.join(", ") || "None"}`
  }

  const handleCopyPrompt = (result: AccessibilityResult) => {
    navigator.clipboard.writeText(formatIssuePrompt(result))
    toast({
      title: "Success",
      description: "Issue details copied to clipboard",
    })
  }

  const handleOpenInCursor = (result: AccessibilityResult) => {
    const messageText = formatIssuePrompt(result)
    try {
      const encodedMessage = encodeURIComponent(messageText)
      window.open(`cursor://chat/new?message=${encodedMessage}`, "_blank")
      navigator.clipboard.writeText(messageText)
      toast({
        title: "Opening in Cursor",
        description: "Launching Cursor chat with issue details",
      })
    } catch (error) {
      navigator.clipboard.writeText(messageText)
      window.open("cursor://chat", "_blank")
      toast({
        title: "Issue details copied to clipboard",
        description: "If Cursor doesn't open with the issue, paste it manually in the chat",
      })
    }
  }

  const extractImageUrl = (elementHtml: string): string | null => {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(elementHtml, 'text/html')
      const img = doc.querySelector('img')
      if (img) {
        let src = img.getAttribute('src')
        if (src) {
          if (src.startsWith('//')) {
            src = 'https:' + src
          } else if (src.startsWith('/')) {
            const pageUrl = new URL(results.find(r => r.element === elementHtml)?.url || '')
            src = pageUrl.origin + src
          } else if (!src.startsWith('http')) {
            const pageUrl = new URL(results.find(r => r.element === elementHtml)?.url || '')
            src = new URL(src, pageUrl.href).href
          }
          return src
        }
      }
      return null
    } catch {
      return null
    }
  }

  const isImageRelatedIssue = (result: AccessibilityResult): boolean => {
    const imageKeywords = ['alt', 'image', 'img', 'missing alt', 'empty alt']
    return imageKeywords.some(keyword =>
      result.message.toLowerCase().includes(keyword) ||
      result.element?.toLowerCase().includes('<img')
    )
  }

  const isVisualIssue = (result: AccessibilityResult): boolean => {
    const visualKeywords = ['contrast', 'color', 'visual', 'background', 'text color']
    return visualKeywords.some(keyword =>
      result.message.toLowerCase().includes(keyword)
    )
  }

  const handleViewImage = (result: AccessibilityResult) => {
    setSelectedResult(result)
    setLoadingImage(true)
    setImageError(null)
    setSelectedImage(null)

    const imageUrl = extractImageUrl(result.element || '')
    if (imageUrl) {
      const img = document.createElement('img')
      img.onload = () => {
        setSelectedImage(imageUrl)
        setLoadingImage(false)
      }
      img.onerror = () => {
        setImageError("Failed to load image from URL")
        setLoadingImage(false)
      }
      img.src = imageUrl
    } else {
      setImageError("Could not extract image URL from element")
      setLoadingImage(false)
    }
  }

  const handleViewIssue = async (result: AccessibilityResult) => {
    setSelectedResult(result)
    setLoadingScreenshot(true)
    setScreenshotError(null)
    setIssueScreenshot(null)

    try {
      const response = await fetch('/api/capture-element', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: result.url,
          elementPath: (result as any).elementPath || '',
          element: result.element,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to capture element screenshot: ${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()
      const imageUrl = URL.createObjectURL(blob)
      setIssueScreenshot(imageUrl)
    } catch (error) {
      console.error('Error capturing element screenshot:', error)
      setScreenshotError(error instanceof Error ? error.message : "Failed to capture screenshot")
    } finally {
      setLoadingScreenshot(false)
    }
  }

  const resetDialogState = () => {
    setSelectedImage(null)
    setIssueScreenshot(null)
    setSelectedResult(null)
    setImageError(null)
    setScreenshotError(null)
    setLoadingImage(false)
    setLoadingScreenshot(false)
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-red-100 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Critical</div>
            <div className="text-2xl font-bold text-black">{summary.critical}</div>
          </div>
          <div className="bg-orange-100 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Serious</div>
            <div className="text-2xl font-bold text-black">{summary.serious}</div>
          </div>
          <div className="bg-yellow-100 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Moderate</div>
            <div className="text-2xl font-bold text-black">{summary.moderate}</div>
          </div>
          <div className="bg-blue-100 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Minor</div>
            <div className="text-2xl font-bold text-black">{summary.minor}</div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search issues..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <Filter className="mr-2 h-4 w-4" />
              Severity
              {severityFilters.length > 0 && (
                <Badge className="ml-2 bg-red-400" variant="secondary">
                  {severityFilters.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Filter by Severity</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={severityFilters.includes("critical")}
              onCheckedChange={(checked) => {
                const newFilters = checked
                  ? [...severityFilters, "critical"]
                  : severityFilters.filter(f => f !== "critical")
                onSeverityFilterChange(newFilters)
              }}
            >
              Critical
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={severityFilters.includes("serious")}
              onCheckedChange={(checked) => {
                const newFilters = checked
                  ? [...severityFilters, "serious"]
                  : severityFilters.filter(f => f !== "serious")
                onSeverityFilterChange(newFilters)
              }}
            >
              Serious
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={severityFilters.includes("moderate")}
              onCheckedChange={(checked) => {
                const newFilters = checked
                  ? [...severityFilters, "moderate"]
                  : severityFilters.filter(f => f !== "moderate")
                onSeverityFilterChange(newFilters)
              }}
            >
              Moderate
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={severityFilters.includes("minor")}
              onCheckedChange={(checked) => {
                const newFilters = checked
                  ? [...severityFilters, "minor"]
                  : severityFilters.filter(f => f !== "minor")
                onSeverityFilterChange(newFilters)
              }}
            >
              Minor
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <Filter className="mr-2 h-4 w-4" />
              Compliance
              {complianceFilters.length > 0 && (
                <Badge className="ml-2 bg-green-500" variant="secondary">
                  {complianceFilters.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Filter by Compliance</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={complianceFilters.includes("wcag2a")}
              onCheckedChange={(checked) => {
                const newFilters = checked
                  ? [...complianceFilters, "wcag2a"]
                  : complianceFilters.filter(f => f !== "wcag2a")
                onComplianceFilterChange(newFilters)
              }}
            >
              WCAG 2.0 A
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={complianceFilters.includes("wcag2aa")}
              onCheckedChange={(checked) => {
                const newFilters = checked
                  ? [...complianceFilters, "wcag2aa"]
                  : complianceFilters.filter(f => f !== "wcag2aa")
                onComplianceFilterChange(newFilters)
              }}
            >
              WCAG 2.0 AA
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={complianceFilters.includes("wcag2aaa")}
              onCheckedChange={(checked) => {
                const newFilters = checked
                  ? [...complianceFilters, "wcag2aaa"]
                  : complianceFilters.filter(f => f !== "wcag2aaa")
                onComplianceFilterChange(newFilters)
              }}
            >
              WCAG 2.0 AAA
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={complianceFilters.includes("section508")}
              onCheckedChange={(checked) => {
                const newFilters = checked
                  ? [...complianceFilters, "section508"]
                  : complianceFilters.filter(f => f !== "section508")
                onComplianceFilterChange(newFilters)
              }}
            >
              Section 508
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={complianceFilters.includes("best-practice")}
              onCheckedChange={(checked) => {
                const newFilters = checked
                  ? [...complianceFilters, "best-practice"]
                  : complianceFilters.filter(f => f !== "best-practice")
                onComplianceFilterChange(newFilters)
              }}
            >
              Best Practices
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="severity">Sort by Severity</SelectItem>
            <SelectItem value="url">Sort by URL</SelectItem>
            <SelectItem value="date">Sort by Date</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto" disabled={results.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Export Format</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={false}
              onCheckedChange={() => handleExport('excel')}
              disabled={exporting}
            >
              {exporting && exportFormat === 'excel' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting Excel...
                </>
              ) : (
                <>
                  📊 Export as Excel (.xlsx)
                </>
              )}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={false}
              onCheckedChange={() => handleExport('pdf')}
              disabled={exporting}
            >
              {exporting && exportFormat === 'pdf' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting PDF...
                </>
              ) : (
                <>
                  📄 Export as PDF (.pdf)
                </>
              )}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {(severityFilters.length > 0 || complianceFilters.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {severityFilters.map((severity) => (
            <Badge key={severity} variant="outline" className="flex items-center gap-1 bg-teal-400">
              {severity}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onSeverityFilterChange(severityFilters.filter(f => f !== severity))}
              />
            </Badge>
          ))}
          {complianceFilters.map((compliance) => (
            <Badge key={compliance} variant="outline" className="flex items-center gap-1 bg-indigo-400">
              {compliance}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onComplianceFilterChange(complianceFilters.filter(f => f !== compliance))}
              />
            </Badge>
          ))}
          {(severityFilters.length > 0 || complianceFilters.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              className='bg-red-400'
              onClick={() => {
                onSeverityFilterChange([])
                onComplianceFilterChange([])
              }}
            >
              Clear all filters
            </Button>
          )}
        </div>
      )}

      {exporting && (
        <div className="mb-4 p-4 bg-white border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600 mr-2" />
              <span className="text-indigo-800 font-medium">
                Preparing {exportFormat?.toUpperCase()} export...
              </span>
            </div>
            <span className="text-indigo-600 text-sm font-medium">{exportProgress}%</span>
          </div>

          <div className="w-full bg-indigo-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${exportProgress}%` }}
            ></div>
          </div>

          <div className="mt-2 text-sm text-blue-600">
            {exportProgress < 30 && "Collecting accessibility data..."}
            {exportProgress >= 30 && exportProgress < 70 && "Processing issues and organizing by severity..."}
            {exportProgress >= 70 && exportProgress < 90 && "Generating report with images..."}
            {exportProgress >= 90 && exportProgress < 100 && "Finalizing download..."}
            {exportProgress === 100 && "Export complete!"}
          </div>

          {exportError && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
              ❌ Export failed: {exportError}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          {searchQuery || severityFilters.length > 0 || complianceFilters.length > 0
            ? "No results match your search filters. Try adjusting your criteria."
            : "No results found. Add URLs to analyze."}
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="hidden sm:table-cell">Est. Fix Time</TableHead>
                  <TableHead className="hidden md:table-cell">Element</TableHead>
                  <TableHead className="hidden lg:table-cell">Compliance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium truncate max-w-[150px]" title={result.url}>
                      <div className="flex items-center">
                        <span className="truncate">{result.url}</span>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 text-gray-500 hover:text-gray-700"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="truncate max-w-[200px]" title={result.message}>
                        {result.message}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 truncate" title={result.help}>
                        {result.help}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getSeverityColor(result.severity)}>{result.severity}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="text-sm font-medium text-blue-600 bg-white rounded-full p-2  w-fit">
                        {(result as any).estimatedFixTime || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <code
                        className="text-xs bg-gray-100 text-black p-1 rounded truncate max-w-[200px] block"
                        title={result.element || ''}
                      >
                        {result.element}
                      </code>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {result.tags?.map((tag, tagIndex) => (
                          <Badge key={tagIndex} className={getTagColor(tag)}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleCopyPrompt(result)}
                          className="flex items-center gap-1"
                        >
                          <Copy className="h-4 w-4" />
                          Copy Prompt
                        </Button>

                        {isImageRelatedIssue(result) && (
                          <Dialog onOpenChange={(open) => !open && resetDialogState()}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewImage(result)}
                                className="flex items-center gap-1"
                              >
                                <Image className="h-4 w-4" />
                                View Image
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                              <DialogHeader>
                                <DialogTitle>Image Preview</DialogTitle>
                                <DialogDescription>
                                  Image from the accessibility issue
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-4">
                                {loadingImage && (
                                  <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="ml-2">Loading image...</span>
                                  </div>
                                )}

                                {selectedImage && !loadingImage && (
                                  <div className="flex justify-center">
                                    <img
                                      src={selectedImage}
                                      alt="Issue related image"
                                      className="max-w-full max-h-96 object-contain border rounded shadow-lg"
                                    />
                                  </div>
                                )}

                                {imageError && !loadingImage && (
                                  <div className="space-y-4">
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                      <div className="flex items-center">
                                        <X className="h-5 w-5 text-red-500 mr-2" />
                                        <span className="text-red-700 font-medium">Failed to load image</span>
                                      </div>
                                      <p className="text-red-600 text-sm mt-1">{imageError}</p>
                                    </div>

                                    <div className="border-t pt-4">
                                      <h4 className="font-medium mb-2">Element HTML Code:</h4>
                                      <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap border">
                                        {selectedResult?.element}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}

                        {isVisualIssue(result) && (
                          <Dialog onOpenChange={(open) => !open && resetDialogState()}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewIssue(result)}
                                className="flex items-center gap-1"
                                disabled={loadingScreenshot}
                              >
                                {loadingScreenshot ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                                View Issue
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                              <DialogHeader>
                                <DialogTitle>Visual Issue Preview</DialogTitle>
                                <DialogDescription>
                                  Screenshot of the element with the accessibility issue
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-4">
                                {loadingScreenshot && (
                                  <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="ml-2">Capturing screenshot...</span>
                                  </div>
                                )}

                                {issueScreenshot && !loadingScreenshot && (
                                  <div className="flex justify-center">
                                    <img
                                      src={issueScreenshot}
                                      alt="Visual issue screenshot"
                                      className="max-w-full max-h-96 object-contain border rounded shadow-lg"
                                    />
                                  </div>
                                )}

                                {screenshotError && !loadingScreenshot && (
                                  <div className="space-y-4">
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                      <div className="flex items-center">
                                        <X className="h-5 w-5 text-red-500 mr-2" />
                                        <span className="text-red-700 font-medium">Failed to capture screenshot</span>
                                      </div>
                                      <p className="text-red-600 text-sm mt-1">{screenshotError}</p>
                                    </div>

                                    <div className="border-t pt-4">
                                      <h4 className="font-medium mb-2">Element HTML Code:</h4>
                                      <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap border">
                                        {selectedResult?.element}
                                      </pre>
                                    </div>

                                    {(selectedResult as any)?.details && (
                                      <div className="border-t pt-4">
                                        <h4 className="font-medium mb-2">Issue Details:</h4>
                                        <div className="bg-blue-50 p-3 rounded text-sm border">
                                          <pre className="whitespace-pre-wrap">
                                            {JSON.stringify((selectedResult as any).details, null, 2)}
                                          </pre>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNumber = page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i

                  if (pageNumber <= 0 || pageNumber > totalPages) return null

                  return (
                    <PaginationItem key={i}>
                      <PaginationLink
                        isActive={page === pageNumber}
                        onClick={() => onPageChange(pageNumber)}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  )
}