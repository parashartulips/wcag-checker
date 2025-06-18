import { NextRequest, NextResponse } from "next/server"
import { getAccessibilityResults } from "@/lib/actions"
import ExcelJS from "exceljs"
import { chromium } from "playwright-core"

export async function POST(request: NextRequest) {
  try {
    const { format, data, includeScreenshots, organizeBySeverity } = await request.json()
    
    // Use the data passed from frontend instead of fetching again
    if (!data || !data.results || !data.summary) {
      return NextResponse.json({ error: "No data provided for export" }, { status: 400 })
    }

    const { results, summary } = data

    if (format === "pdf") {
      return await generatePDFReport(results, summary, includeScreenshots, organizeBySeverity)
    } else {
      return await generateExcelReport(results, summary, includeScreenshots, organizeBySeverity)
    }
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    )
  }
}

async function generateExcelReport(results: any[], summary: any, includeScreenshots: boolean, organizeBySeverity: boolean) {
  const workbook = new ExcelJS.Workbook()
  
  // Add metadata
  workbook.creator = "WCAG Accessibility Checker"
  workbook.created = new Date()
  workbook.title = "Accessibility Report"
  workbook.description = "Comprehensive accessibility analysis report"

  // Create summary worksheet
  const summarySheet = workbook.addWorksheet("Summary")
  
  // Add title and summary
  summarySheet.mergeCells("A1:F1")
  const titleCell = summarySheet.getCell("A1")
  titleCell.value = "Accessibility Report Summary"
  titleCell.font = { size: 18, bold: true, color: { argb: "FF000080" } }
  titleCell.alignment = { horizontal: "center", vertical: "middle" }
  
  // Add summary data
  summarySheet.addRow([])
  summarySheet.addRow(["Report Generated:", new Date().toLocaleDateString()])
  summarySheet.addRow(["Total Issues:", summary?.total || 0])
  summarySheet.addRow(["URLs Analyzed:", summary?.urlsAnalyzed || 0])
  summarySheet.addRow([])
  
  // Add severity breakdown
  summarySheet.addRow(["Severity Breakdown:"])
  summarySheet.addRow(["Critical:", summary?.critical || 0])
  summarySheet.addRow(["Serious:", summary?.serious || 0])
  summarySheet.addRow(["Moderate:", summary?.moderate || 0])
  summarySheet.addRow(["Minor:", summary?.minor || 0])

  if (organizeBySeverity) {
    // Create separate sheets for each severity level
    const severityLevels = ["critical", "serious", "moderate", "minor"]
    
    for (const severity of severityLevels) {
      const severityResults = results.filter(r => r.severity.toLowerCase() === severity)
      
      if (severityResults.length > 0) {
        const sheet = workbook.addWorksheet(`${severity.charAt(0).toUpperCase() + severity.slice(1)} Issues`)
        await addResultsToSheet(sheet, severityResults, severity, includeScreenshots)
      }
    }
  } else {
    // Create a single sheet with all results
    const allIssuesSheet = workbook.addWorksheet("All Issues")
    await addResultsToSheet(allIssuesSheet, results, "all", includeScreenshots)
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="accessibility-report-${new Date().toISOString().split('T')[0]}.xlsx"`,
    },
  })
}

async function addResultsToSheet(sheet: ExcelJS.Worksheet, results: any[], severity: string, includeScreenshots: boolean) {
  // Add headers
  const headers = ["URL", "Issue", "Severity", "Element", "Help", "Compliance Tags", "Created At"]
  if (includeScreenshots) {
    headers.push("Screenshot Info")
  }
  
  const headerRow = sheet.addRow(headers)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: getSeverityColor(severity) },
    }
    cell.alignment = { horizontal: "center", vertical: "middle" }
  })

  // Add data rows
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    
    // Prepare row data
    const rowData = [
      result.url || "N/A",
      result.message || "N/A",
      result.severity || "N/A",
      result.element ? (result.element.length > 200 ? result.element.substring(0, 200) + "..." : result.element) : "N/A",
      result.help || "N/A",
      result.tags ? result.tags.join(", ") : "N/A",
      result.createdAt ? new Date(result.createdAt).toLocaleDateString() : "N/A",
    ]

    if (includeScreenshots) {
      // Add screenshot info
      const screenshotInfo = result.screenshotPath ? "Screenshot captured" : "Use 'View Issue' button in app to capture screenshot"
      rowData.push(screenshotInfo)
    }

    const row = sheet.addRow(rowData)

    // Color code by severity
    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: getSeverityColor(result.severity, true) },
      }
      // Wrap text for better readability
      cell.alignment = { wrapText: true, vertical: "top" }
    })

    // Set row height to accommodate wrapped text
    row.height = 60
  }

  // Auto-fit columns
  sheet.columns.forEach((column, index) => {
    if (index === 0) { // URL column
      column.width = 40
    } else if (index === 1) { // Issue column
      column.width = 50
    } else if (index === 3) { // Element column
      column.width = 60
    } else if (index === 4) { // Help column
      column.width = 50
    } else {
      column.width = 20
    }
  })
}

async function generatePDFReport(results: any[], summary: any, includeScreenshots: boolean, organizeBySeverity: boolean) {
  let browser = null
  
  try {
    // Launch browser with more stable configuration
    browser = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    })
    
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      deviceScaleFactor: 1,
    })
    
    const page = await context.newPage()

    // Generate HTML content for PDF (simplified without complex image embedding)
    const htmlContent = generateSimplifiedReportHTML(results, summary, includeScreenshots, organizeBySeverity)
    
    console.log("Setting PDF content...")
    
    // Set content with proper encoding and wait for load
    await page.setContent(htmlContent, { 
      waitUntil: "domcontentloaded",
      timeout: 15000 
    })
    
    // Wait a bit for any remaining content to render
    await page.waitForTimeout(1000)
    
    console.log("Generating PDF...")
    
    // Generate PDF with simplified options
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      scale: 0.8,
      margin: {
        top: "25mm",
        bottom: "25mm", 
        left: "15mm",
        right: "15mm",
      },
      displayHeaderFooter: false, // Disable to avoid issues
    })

    console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`)

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="accessibility-report-${new Date().toISOString().split('T')[0]}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    console.error("PDF generation error:", error)
    return NextResponse.json(
      { error: `PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.error("Error closing browser:", closeError)
      }
    }
  }
}

// Simplified HTML generation without complex image embedding
function generateSimplifiedReportHTML(results: any[], summary: any, includeScreenshots: boolean, organizeBySeverity: boolean): string {
  const severityLevels = ["critical", "serious", "moderate", "minor"]
  
  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Accessibility Report</title>
        <style>
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            
            body { 
                font-family: 'Arial', sans-serif; 
                line-height: 1.5; 
                color: #333;
                background: white;
                font-size: 12px;
            }
            
            .header { 
                text-align: center; 
                margin-bottom: 30px; 
                border-bottom: 2px solid #2563eb;
                padding-bottom: 15px;
            }
            
            .header h1 {
                color: #1e40af;
                font-size: 24px;
                margin-bottom: 5px;
            }
            
            .header p {
                color: #64748b;
                font-size: 11px;
            }
            
            .summary { 
                background: #f8fafc; 
                padding: 20px; 
                border-radius: 8px; 
                margin-bottom: 25px; 
                border: 1px solid #e2e8f0;
            }
            
            .summary h2 {
                color: #1e40af;
                font-size: 16px;
                margin-bottom: 15px;
            }
            
            .summary-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
            }
            
            .summary-item {
                display: flex;
                justify-content: space-between;
                padding: 8px;
                background: white;
                border-radius: 4px;
                border: 1px solid #e2e8f0;
            }
            
            .severity-critical { 
                background: #fee2e2; 
                border-left: 4px solid #dc2626; 
                margin-bottom: 15px;
                page-break-inside: avoid;
            }
            .severity-serious { 
                background: #fed7aa; 
                border-left: 4px solid #ea580c; 
                margin-bottom: 15px;
                page-break-inside: avoid;
            }
            .severity-moderate { 
                background: #fef3c7; 
                border-left: 4px solid #d97706; 
                margin-bottom: 15px;
                page-break-inside: avoid;
            }
            .severity-minor { 
                background: #dbeafe; 
                border-left: 4px solid #2563eb; 
                margin-bottom: 15px;
                page-break-inside: avoid;
            }
            
            .issue { 
                padding: 15px; 
                border-radius: 6px; 
                page-break-inside: avoid;
                border: 1px solid rgba(0,0,0,0.1);
            }
            
            .issue-title { 
                font-weight: bold; 
                margin-bottom: 10px; 
                font-size: 13px; 
                color: #1e293b;
                border-bottom: 1px solid rgba(0,0,0,0.1);
                padding-bottom: 5px;
            }
            
            .issue-details { 
                font-size: 11px; 
                color: #475569; 
                margin-bottom: 10px; 
                line-height: 1.4;
            }
            
            .issue-details strong { 
                color: #1e293b; 
                display: inline-block;
                min-width: 80px;
            }
            
            .element-code { 
                background: #f1f5f9; 
                padding: 10px; 
                border-radius: 4px; 
                font-family: 'Courier New', monospace; 
                font-size: 10px; 
                margin: 10px 0; 
                border: 1px solid #e2e8f0;
                word-break: break-all;
                white-space: pre-wrap;
                max-height: 100px;
                overflow: hidden;
            }
            
            .page-break { 
                page-break-before: always; 
            }
            
            h2 { 
                color: #1e40af;
                font-size: 16px;
                margin: 20px 0 15px 0;
                border-bottom: 2px solid #e2e8f0; 
                padding-bottom: 5px; 
            }
            
            .image-info {
                background: #fff3cd;
                border: 1px solid #f59e0b;
                padding: 8px;
                border-radius: 4px;
                margin: 8px 0;
                font-size: 10px;
            }
            
            .screenshot-info {
                background: #e0f2fe;
                border: 1px solid #0ea5e9;
                padding: 8px;
                border-radius: 4px;
                margin: 8px 0;
                font-size: 10px;
            }
            
            .report-footer {
                margin-top: 30px; 
                padding: 15px; 
                background: #f8fafc; 
                border-radius: 6px; 
                font-size: 10px;
                border: 1px solid #e2e8f0;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🔍 WCAG Accessibility Report</h1>
            <p>Generated on ${new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })} at ${new Date().toLocaleTimeString('en-US')}</p>
        </div>
        
        <div class="summary">
            <h2>📊 Executive Summary</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <strong>Total Issues:</strong>
                    <span>${summary?.total || 0}</span>
                </div>
                <div class="summary-item">
                    <strong>URLs Analyzed:</strong>
                    <span>${summary?.urlsAnalyzed || 1}</span>
                </div>
                <div class="summary-item">
                    <strong>🔴 Critical:</strong>
                    <span style="color: #dc2626; font-weight: bold;">${summary?.critical || 0}</span>
                </div>
                <div class="summary-item">
                    <strong>🟠 Serious:</strong>
                    <span style="color: #ea580c; font-weight: bold;">${summary?.serious || 0}</span>
                </div>
                <div class="summary-item">
                    <strong>🟡 Moderate:</strong>
                    <span style="color: #d97706; font-weight: bold;">${summary?.moderate || 0}</span>
                </div>
                <div class="summary-item">
                    <strong>🔵 Minor:</strong>
                    <span style="color: #2563eb; font-weight: bold;">${summary?.minor || 0}</span>
                </div>
            </div>
        </div>
  `

  if (organizeBySeverity) {
    for (const severity of severityLevels) {
      const severityResults = results.filter(r => r.severity.toLowerCase() === severity)
      
      if (severityResults.length > 0) {
        html += `
          <div class="page-break">
            <h2>${getSeverityIcon(severity)} ${severity.charAt(0).toUpperCase() + severity.slice(1)} Issues (${severityResults.length})</h2>
        `
        
        severityResults.forEach((result, index) => {
          const imageUrl = extractImageFromElement(result.element)
          const isImageIssue = result.message?.toLowerCase().includes('alt') || 
                              result.message?.toLowerCase().includes('image') ||
                              result.element?.toLowerCase().includes('<img')
          
          html += `
            <div class="issue severity-${severity}">
              <div class="issue-title">Issue ${index + 1}: ${escapeHtml(result.message || 'N/A')}</div>
              <div class="issue-details">
                <strong>🌐 URL:</strong> ${escapeHtml(result.url || 'N/A')}<br>
                <strong>⚠️ Severity:</strong> ${escapeHtml(result.severity || 'N/A')}<br>
                <strong>💡 Help:</strong> ${escapeHtml(result.help || 'N/A')}<br>
                                 <strong>📋 Tags:</strong> ${result.tags?.map((tag: string) => escapeHtml(tag)).join(", ") || "N/A"}<br>
                <strong>📅 Date:</strong> ${result.createdAt ? new Date(result.createdAt).toLocaleDateString('en-US') : 'N/A'}
              </div>
              
              ${isImageIssue && imageUrl ? `
                <div class="image-info">
                  <strong>🖼️ Image Found:</strong> ${escapeHtml(imageUrl)}
                  <br><em>Use the web application to view this image and capture screenshots.</em>
                </div>
              ` : ''}
              
              <div class="element-code">
                <strong>📝 HTML Element:</strong><br>
                ${escapeHtml((result.element || 'N/A').substring(0, 500))}${result.element && result.element.length > 500 ? '...' : ''}
              </div>
              
              ${includeScreenshots ? `
                <div class="screenshot-info">
                  <strong>📸 Screenshot:</strong> Available in web application
                  <br><em>Open the WCAG Checker app and click "View Issue" to capture element screenshots.</em>
                </div>
              ` : ''}
            </div>
          `
        })
        
        html += `</div>`
      }
    }
  } else {
    html += `<h2>📋 All Issues (${results.length})</h2>`
    
    results.forEach((result, index) => {
      const imageUrl = extractImageFromElement(result.element)
      const isImageIssue = result.message?.toLowerCase().includes('alt') || 
                          result.message?.toLowerCase().includes('image') ||
                          result.element?.toLowerCase().includes('<img')
      
      html += `
        <div class="issue severity-${result.severity}">
          <div class="issue-title">Issue ${index + 1}: ${escapeHtml(result.message)}</div>
          <div class="issue-details">
            <strong>🌐 URL:</strong> ${escapeHtml(result.url)}<br>
            <strong>⚠️ Severity:</strong> ${escapeHtml(result.severity)}<br>
            <strong>💡 Help:</strong> ${escapeHtml(result.help)}<br>
            <strong>📋 Tags:</strong> ${result.tags?.map((tag: string) => escapeHtml(tag)).join(", ") || "N/A"}<br>
            <strong>📅 Date:</strong> ${new Date(result.createdAt).toLocaleDateString('en-US')}
          </div>
          
          ${isImageIssue && imageUrl ? `
            <div class="image-info">
              <strong>🖼️ Image Found:</strong> ${escapeHtml(imageUrl)}
            </div>
          ` : ''}
          
          <div class="element-code">
            <strong>📝 Element:</strong><br>
            ${escapeHtml((result.element || 'N/A').substring(0, 500))}${result.element && result.element.length > 500 ? '...' : ''}
          </div>
        </div>
      `
    })
  }

  html += `
        <div class="report-footer">
          <h3>📋 Report Information</h3>
          <p><strong>Generated by:</strong> WCAG Accessibility Checker v2.0</p>
          <p><strong>Report Type:</strong> ${organizeBySeverity ? 'Organized by Severity Level' : 'Complete Issues List'}</p>
          <p><strong>Screenshots:</strong> ${includeScreenshots ? 'Use web application for interactive screenshots' : 'Text-based Report'}</p>
          <p><strong>Standards:</strong> WCAG 2.0/2.1/2.2 Guidelines, Section 508, Best Practices</p>
          <br>
          <p style="font-size: 9px; color: #666;">
            This report was generated automatically. For interactive features, visual screenshots, and detailed analysis, 
            please use the WCAG Accessibility Checker web application.
          </p>
        </div>
    </body>
    </html>
  `

  return html
}

// Helper function to get severity icon
function getSeverityIcon(severity: string): string {
  const icons = {
    critical: '🔴',
    serious: '🟠', 
    moderate: '🟡',
    minor: '🔵'
  }
  return icons[severity as keyof typeof icons] || '⚪'
}

// Helper function to extract image URL from HTML element
function extractImageFromElement(elementHtml: string): string | null {
  if (!elementHtml) return null
  
  try {
    // Look for img tags and extract src attribute
    const imgMatch = elementHtml.match(/<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/i)
    if (imgMatch) {
      return imgMatch[1]
    }
    
    // Look for background-image in style attribute
    const bgMatch = elementHtml.match(/background-image\s*:\s*url\s*\(\s*["']?([^"')]+)["']?\s*\)/i)
    if (bgMatch) {
      return bgMatch[1]
    }
    
    return null
  } catch (error) {
    return null
  }
}

// Helper function to escape HTML
function escapeHtml(text: string): string {
  if (!text) return ''
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getSeverityColor(severity: string, light: boolean = false): string {
  const colors = {
    critical: light ? "FFFFE2E2" : "FFDC2626",
    serious: light ? "FFFED7AA" : "FFEA580C", 
    moderate: light ? "FFFEF3C7" : "FFD97706",
    minor: light ? "FFDBEAFE" : "FF2563EB",
    all: light ? "FFF5F5F5" : "FF6B7280",
  }
  return colors[severity as keyof typeof colors] || colors.all
} 