export interface AccessibilityResult {
  id: string
  url: string
  message: string
  help: string
  element: string
  elementPath?: string
  impact: string
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
  tags: string[]
  details?: Record<string, any>
  screenshotPath?: string
  createdAt: string
}

export interface AccessibilitySummary {
  critical: number
  serious: number
  moderate: number
  minor: number
  total: number
  urlsAnalyzed: number
}

export interface ResultsQueryParams {
  urls: string[]
  page: number
  pageSize: number
  sortBy: string
  search?: string
  severityFilters?: string[]
  complianceFilters?: string[]  
}

export interface ComplianceOptions {
  wcagLevel: 'a' | 'aa' | 'aaa'
  section508?: boolean
  bestPractices?: boolean
  experimental?: boolean
  captureScreenshots?: boolean
}

export interface ScanResult {
  url: string
  results: AccessibilityResult[]
  summary: AccessibilitySummary
}
