import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import * as ExcelJS from 'exceljs'
import * as fs from 'fs/promises'
import * as path from 'path'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

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
    time *= 0.2 // Color contrast is usually quick CSS fix
  } else if (message?.toLowerCase().includes('alt') || 
             message?.toLowerCase().includes('alternative text')) {
    time *= 0.05 // Alt text is very quick to add
  } else if (message?.toLowerCase().includes('heading') || 
             message?.toLowerCase().includes('structure')) {
    time *= 1 // Structural changes take longer
  } else if (message?.toLowerCase().includes('keyboard') || 
             message?.toLowerCase().includes('focus')) {
    time *= 3 // Keyboard accessibility can be complex
  } else if (message?.toLowerCase().includes('aria') || 
             message?.toLowerCase().includes('role')) {
    time *= 2 // ARIA attributes are moderately complex
  }
  
  // Adjust based on compliance level (more strict = more time)
  if (tags?.includes('wcag2aaa')) {
    time *= 1.1
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

export async function GET(request: NextRequest) {
  try {
    // Extract query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const format = searchParams.get('format') || 'excel'; // Get the format parameter
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'severity';
    const exportAll = searchParams.has('exportAll') ? true : false;
    const projectId = searchParams.get('projectId');
    const scanId = searchParams.get('scanId');
    
    // Handle array parameters (severityFilters and complianceFilters)
    const severityFilters = searchParams.getAll('severityFilters');
    const complianceFilters = searchParams.getAll('complianceFilters');
    
    // Build where clause for filtering
    let whereClause: any = {};
    
    // Filter by project or scan if specified
    if (scanId) {
      whereClause.scanId = scanId;
    } else if (projectId) {
      whereClause.scan = {
        projectId: projectId
      };
    }
    
    // Apply search filter
    if (search) {
      whereClause.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { url: { contains: search, mode: 'insensitive' } },
        { element: { contains: search, mode: 'insensitive' } },
        { help: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Apply severity filters
    if (severityFilters.length > 0) {
      whereClause.severity = { in: severityFilters };
    }
    
    // Apply compliance filters (filter by tags)
    if (complianceFilters.length > 0) {
      whereClause.tags = {
        hasSome: complianceFilters
      };
    }
    
    // Fetch results from database
    const rawResults = await prisma.result.findMany({
      where: whereClause,
      include: {
        scan: {
          include: {
            project: true
          }
        }
      },
      orderBy: getOrderBy(sortBy)
    });

    if (rawResults.length === 0) {
      return NextResponse.json({ 
        error: "No accessibility results found. Please run some scans first." 
      }, { status: 400 });
    }

    // Apply deduplication if filtering by project (not specific scan)
    let results = rawResults;
    if (projectId && !scanId) {
      // Create deduplication map based on (url + message + element + severity)
      const deduplicationMap = new Map<string, any>();
      
      rawResults.forEach(result => {
        const key = `${result.url}|${result.message}|${result.element || ''}|${result.severity}`;
        
        // Keep the most recent result for each unique combination
        if (!deduplicationMap.has(key) || 
            new Date(result.createdAt) > new Date(deduplicationMap.get(key).createdAt)) {
          deduplicationMap.set(key, result);
        }
      });
      
      results = Array.from(deduplicationMap.values());
      console.log(`Export: Deduplicated ${rawResults.length} results to ${results.length} unique results`);
    }


    // Handle PDF export
    if (format === 'pdf') {
      const { filePath, filename } = await generatePDFReport(results, {
        search,
        sortBy,
        severityFilters,
        complianceFilters
      });

      // Read the file
      const fileBuffer = await fs.readFile(filePath);
      
      // Clean up the file after reading
      await fs.unlink(filePath).catch(console.error);
      
      // Return the file as a downloadable attachment
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Type': 'application/pdf',
        },
      });
    }
    
    // Generate Excel file
    const { filePath, filename } = await generateExcelReport(results, {
      search,
      sortBy,
      severityFilters,
      complianceFilters
    });

    // Read the file
    const fileBuffer = await fs.readFile(filePath);
    
    // Clean up the file after reading
    await fs.unlink(filePath).catch(console.error);
    
    // Return the file as a downloadable attachment
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
    
  } catch (error) {
    console.error("Error in export API:", error);
    return NextResponse.json({ 
      error: "Failed to export results to Excel" 
    }, { status: 500 });
  }
}

function getOrderBy(sortBy: string) {
  switch (sortBy) {
    case 'severity':
      return [
        { severity: 'desc' as const },
        { createdAt: 'desc' as const }
      ];
    case 'url':
      return { url: 'asc' as const };
    case 'date':
      return { createdAt: 'desc' as const };
    default:
      return { createdAt: 'desc' as const };
  }
}

async function generateExcelReport(
  results: any[], 
  filters: {
    search?: string;
    sortBy?: string;
    severityFilters?: string[];
    complianceFilters?: string[];
  }
) {
  // Create a new Excel workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WCAG Accessibility Checker';
  workbook.created = new Date();
  
  // Create a worksheet for the summary
  const summarySheet = workbook.addWorksheet('Summary');
  
  // Group results by URL for summary
  const urlSummary = new Map();
  results.forEach(result => {
    if (!urlSummary.has(result.url)) {
      urlSummary.set(result.url, {
        url: result.url,
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        total: 0,
        estimatedTimeMinutes: 0
      });
    }
    
    const summary = urlSummary.get(result.url);
    summary[result.severity.toLowerCase()]++;
    summary.total++;
    
    // Add estimated time (convert back to minutes for calculation)
    const timeStr = estimateFixTime(result);
    let minutes = 0;
    if (timeStr.includes('d')) {
      const days = parseInt(timeStr.split('d')[0]);
      const remaining = timeStr.split('d')[1];
      minutes += days * 480; // 8 hours per day
      if (remaining.includes('h')) {
        minutes += parseInt(remaining.split('h')[0]) * 60;
      }
    } else if (timeStr.includes('h')) {
      const hours = parseInt(timeStr.split('h')[0]);
      minutes += hours * 60;
      const remaining = timeStr.split('h')[1];
      if (remaining.includes('m')) {
        minutes += parseInt(remaining.split('m')[0]);
      }
    } else if (timeStr.includes('m')) {
      minutes = parseInt(timeStr.split('m')[0]);
    }
    summary.estimatedTimeMinutes += minutes;
  });
  
  // Convert estimated time back to readable format for each URL
  urlSummary.forEach(summary => {
    const minutes = summary.estimatedTimeMinutes;
    if (minutes < 60) {
      summary.estimatedTime = `${Math.round(minutes)}m`;
    } else if (minutes < 480) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = Math.round(minutes % 60);
      summary.estimatedTime = remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    } else {
      const days = Math.floor(minutes / 480);
      const remainingHours = Math.floor((minutes % 480) / 60);
      summary.estimatedTime = remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }
    delete summary.estimatedTimeMinutes; // Remove the temporary field
  });
  
  // Add summary headers
  summarySheet.columns = [
    { header: 'URL', key: 'url', width: 50 },
    { header: 'Critical Issues', key: 'critical', width: 15 },
    { header: 'Serious Issues', key: 'serious', width: 15 },
    { header: 'Moderate Issues', key: 'moderate', width: 15 },
    { header: 'Minor Issues', key: 'minor', width: 15 },
    { header: 'Total Issues', key: 'total', width: 15 },
    { header: 'Est. Fix Time', key: 'estimatedTime', width: 15 },
  ];
  
  // Add summary data
  Array.from(urlSummary.values()).forEach(summary => {
    summarySheet.addRow(summary);
  });
  
  // Style the header row
  const headerRow = summarySheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  // Create a worksheet for detailed results
  const detailsSheet = workbook.addWorksheet('Detailed Results');
  
  // Add details headers
  detailsSheet.columns = [
    { header: 'Project', key: 'project', width: 20 },
    { header: 'URL', key: 'url', width: 40 },
    { header: 'Issue ID', key: 'id', width: 20 },
    { header: 'Message', key: 'message', width: 40 },
    { header: 'Help Text', key: 'help', width: 40 },
    { header: 'Element', key: 'element', width: 50 },
    { header: 'Element Path', key: 'elementPath', width: 50 },
    { header: 'Severity', key: 'severity', width: 15 },
    { header: 'Est. Fix Time', key: 'estimatedFixTime', width: 15 },
    { header: 'Tags', key: 'tags', width: 30 },
    { header: 'Created At', key: 'createdAt', width: 20 },
  ];
  
  // Add all results to the sheet
  results.forEach(result => {
    detailsSheet.addRow({
      project: result.scan?.project?.name || 'Unknown Project',
      url: result.url,
      id: result.id,
      message: result.message,
      help: result.help || 'N/A',
      element: result.element ? (result.element.length > 500 ? result.element.substring(0, 500) + '...' : result.element) : 'N/A',
      elementPath: result.elementPath || 'N/A',
      severity: result.severity,
      estimatedFixTime: estimateFixTime(result),
      tags: result.tags ? result.tags.join(', ') : 'N/A',
      createdAt: result.createdAt ? result.createdAt.toISOString() : new Date().toISOString(),
    });
  });
  
  // Style the header row
  const detailsHeaderRow = detailsSheet.getRow(1);
  detailsHeaderRow.font = { bold: true };
  detailsHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  // Create a directory for exports if it doesn't exist
  const exportDir = path.join(process.cwd(), 'exports');
  await fs.mkdir(exportDir, { recursive: true });
  
  // Save the workbook
  const filename = `accessibility-report-${Date.now()}.xlsx`;
  const filePath = path.join(exportDir, filename);
  await workbook.xlsx.writeFile(filePath);
  
  return { filePath, filename };
}

async function generatePDFReport(
  results: any[], 
  filters: {
    search?: string;
    sortBy?: string;
    severityFilters?: string[];
    complianceFilters?: string[];
  }
) {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Embed fonts
  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const headerFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  // Page dimensions
  const pageWidth = 595; // A4 width
  const pageHeight = 842; // A4 height
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;
  
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin;
  
  // Helper function to add a new page when needed
  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition - requiredHeight < margin) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;
      return true;
    }
    return false;
  };
  
  // Helper function to wrap text
  const wrapText = (text: string, maxWidth: number, font: any, fontSize: number) => {
    // Sanitize text by removing/replacing problematic characters
    const sanitizedText = text
      .replace(/[\r\n\t]/g, ' ') // Replace newlines, carriage returns, and tabs with spaces
      .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII characters
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    const words = sanitizedText.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      try {
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        
        if (testWidth <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            // If even a single word is too long, truncate it
            const truncatedWord = word.length > 50 ? word.substring(0, 50) + '...' : word;
            lines.push(truncatedWord);
          }
        }
      } catch (error) {
        // If there's still an encoding error, skip this word or use a fallback
        console.warn('Text encoding error, using fallback:', error);
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '[text encoding error]';
        } else {
          lines.push('[text encoding error]');
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.length > 0 ? lines : ['[empty text]'];
  };
  
  // Helper function to sanitize text for PDF
  const sanitizeForPDF = (text: string) => {
    return text
      .replace(/[\r\n\t]/g, ' ')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/\s+/g, ' ')
      .trim() || '[empty text]';
  };

  // Helper function to extract image URL from HTML element
  const extractImageUrl = (elementHtml: string, pageUrl: string): string | null => {
    try {
      // Use regex to extract src attribute from img tag
      const srcMatch = elementHtml.match(/src\s*=\s*["']([^"']+)["']/i);
      if (srcMatch && srcMatch[1]) {
        let src = srcMatch[1];
        
        if (src.startsWith('//')) {
          src = 'https:' + src;
        } else if (src.startsWith('/')) {
          const baseUrl = new URL(pageUrl);
          src = baseUrl.origin + src;
        } else if (!src.startsWith('http')) {
          src = new URL(src, pageUrl).href;
        }
        return src;
      }
      return null;
    } catch {
      return null;
    }
  };

  // Helper function to check if result is image-related
  const isImageRelatedIssue = (result: any): boolean => {
    const imageKeywords = ['alt', 'image', 'img', 'missing alt', 'empty alt'];
    return imageKeywords.some(keyword =>
      result.message.toLowerCase().includes(keyword) ||
      result.element?.toLowerCase().includes('<img')
    );
  };

  // Helper function to fetch and embed image in PDF
  const embedImageInPDF = async (imageUrl: string, maxWidth: number, maxHeight: number) => {
    try {
      console.log(`Attempting to fetch image: ${imageUrl}`);
      
      // Set a timeout for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/png,image/jpeg,image/jpg,image/gif,image/webp,*/*',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`Failed to fetch image: ${response.status} ${response.statusText}`);
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      console.log(`Image content type: ${contentType}`);
      
      // Check if it's a supported format before downloading
      const isSupportedFormat = 
        contentType.includes('image/png') || 
        contentType.includes('image/jpeg') || 
        contentType.includes('image/jpg') ||
        imageUrl.toLowerCase().includes('.png') ||
        imageUrl.toLowerCase().includes('.jpg') ||
        imageUrl.toLowerCase().includes('.jpeg');
      
      if (!isSupportedFormat) {
        console.log(`Unsupported image format: ${contentType} for URL: ${imageUrl}`);
        return null;
      }

      const imageBytes = await response.arrayBuffer();
      
      if (imageBytes.byteLength === 0) {
        console.log('Empty image data received');
        return null;
      }
      
      let image;
      try {
        if (contentType.includes('image/png') || imageUrl.toLowerCase().includes('.png')) {
          image = await pdfDoc.embedPng(imageBytes);
        } else if (contentType.includes('image/jpeg') || contentType.includes('image/jpg') || 
                   imageUrl.toLowerCase().includes('.jpg') || imageUrl.toLowerCase().includes('.jpeg')) {
          image = await pdfDoc.embedJpg(imageBytes);
        } else {
          console.log(`Could not determine image format for: ${contentType}`);
          return null;
        }
      } catch (embedError) {
        console.error(`Failed to embed image: ${embedError instanceof Error ? embedError.message : String(embedError)}`);
        return null;
      }

      if (!image) {
        console.log('Failed to create image object');
        return null;
      }

      // Calculate scaled dimensions
      const originalWidth = image.width;
      const originalHeight = image.height;
      
      if (!originalWidth || !originalHeight || originalWidth <= 0 || originalHeight <= 0) {
        console.log('Invalid image dimensions');
        return null;
      }
      
      const aspectRatio = originalWidth / originalHeight;

      let scaledWidth = Math.min(maxWidth, originalWidth);
      let scaledHeight = scaledWidth / aspectRatio;

      if (scaledHeight > maxHeight) {
        scaledHeight = maxHeight;
        scaledWidth = scaledHeight * aspectRatio;
      }

      // Ensure minimum size
      if (scaledWidth < 20 || scaledHeight < 20) {
        console.log('Image too small to display');
        return null;
      }

      console.log(`Successfully embedded image: ${scaledWidth}x${scaledHeight}`);
      return { image, width: scaledWidth, height: scaledHeight };
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Image fetch timed out');
      } else {
        console.error('Error embedding image:', error instanceof Error ? error.message : String(error));
      }
      return null;
    }
  };

  // Title
  currentPage.drawText('Accessibility Report', {
    x: margin,
    y: yPosition,
    size: 24,
    font: titleFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 40;
  
  // Summary
  const summaryMap = new Map();
  results.forEach(result => {
    if (!summaryMap.has(result.url)) {
      summaryMap.set(result.url, { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 });
    }
    const summary = summaryMap.get(result.url);
    summary[result.severity.toLowerCase()]++;
    summary.total++;
  });
  
  // Overall summary
  let totalCritical = 0, totalSerious = 0, totalModerate = 0, totalMinor = 0;
  summaryMap.forEach(summary => {
    totalCritical += summary.critical;
    totalSerious += summary.serious;
    totalModerate += summary.moderate;
    totalMinor += summary.minor;
  });
  
  checkPageBreak(120);
  currentPage.drawText('Summary:', {
    x: margin,
    y: yPosition,
    size: 18,
    font: headerFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 30;
  
  const summaryText = [
    `Total URLs analyzed: ${summaryMap.size}`,
    `Total issues found: ${results.length}`,
    `Critical: ${totalCritical}`,
    `Serious: ${totalSerious}`,
    `Moderate: ${totalModerate}`,
    `Minor: ${totalMinor}`
  ];
  
  summaryText.forEach(text => {
    currentPage.drawText(text, {
      x: margin,
      y: yPosition,
      size: 12,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;
  });
  
  yPosition -= 20;
  
  // Detailed results
  checkPageBreak(40);
  currentPage.drawText('Detailed Issues:', {
    x: margin,
    y: yPosition,
    size: 18,
    font: headerFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 30;
  
  // Group by URL
  const groupedResults = new Map();
  results.forEach(result => {
    if (!groupedResults.has(result.url)) {
      groupedResults.set(result.url, []);
    }
    groupedResults.get(result.url).push(result);
  });
  
  // Process each URL
  for (const [url, urlResults] of groupedResults) {
    checkPageBreak(60);
    
    // URL Header
    currentPage.drawText(`URL: ${sanitizeForPDF(url)}`, {
      x: margin,
      y: yPosition,
      size: 14,
      font: headerFont,
      color: rgb(0, 0, 0.8),
    });
    yPosition -= 25;
    
    // URL issues
    for (const result of urlResults) {
      let issueHeight = 80;
      
      // Check if this is an image-related issue and extract image URL
      let imageData = null;
      let imageFailedToLoad = false;
      if (isImageRelatedIssue(result) && result.element) {
        const imageUrl = extractImageUrl(result.element, url);
        if (imageUrl) {
          console.log(`Found image URL for issue: ${imageUrl}`);
          imageData = await embedImageInPDF(imageUrl, contentWidth - 100, 150);
          if (imageData) {
            issueHeight += imageData.height + 20; // Add space for image
          } else {
            imageFailedToLoad = true;
            issueHeight += 40; // Add space for error message
          }
        }
      }
      
      checkPageBreak(issueHeight);
      
      // Severity color
      let severityColor = rgb(0.5, 0.5, 0.5);
      if (result.severity.toLowerCase() === 'critical') severityColor = rgb(0.8, 0, 0);
      else if (result.severity.toLowerCase() === 'serious') severityColor = rgb(1, 0.5, 0);
      else if (result.severity.toLowerCase() === 'moderate') severityColor = rgb(1, 1, 0);
      else if (result.severity.toLowerCase() === 'minor') severityColor = rgb(0, 0.5, 1);
      
      // Severity badge
      currentPage.drawRectangle({
        x: margin,
        y: yPosition - 12,
        width: 80,
        height: 16,
        color: severityColor,
      });
      
      currentPage.drawText(result.severity.toUpperCase(), {
        x: margin + 5,
        y: yPosition - 10,
        size: 10,
        font: headerFont,
        color: rgb(1, 1, 1),
      });
      
      // Issue message
      const messageLines = wrapText(sanitizeForPDF(result.message), contentWidth - 100, regularFont, 10);
      messageLines.forEach((line, index) => {
        currentPage.drawText(line, {
          x: margin + 90,
          y: yPosition - (index * 12),
          size: 10,
          font: regularFont,
          color: rgb(0, 0, 0),
        });
      });
      
      yPosition -= Math.max(20, messageLines.length * 12);
      
      // Add image if available
      if (imageData) {
        yPosition -= 10; // Add some space before image
        
        // Draw a border around the image
        currentPage.drawRectangle({
          x: margin + 10 - 5,
          y: yPosition - imageData.height - 5,
          width: imageData.width + 10,
          height: imageData.height + 10,
          borderColor: rgb(0.8, 0.8, 0.8),
          borderWidth: 1,
        });
        
        // Draw the image
        currentPage.drawImage(imageData.image, {
          x: margin + 10,
          y: yPosition - imageData.height,
          width: imageData.width,
          height: imageData.height,
        });
        
        // Add image caption
        currentPage.drawText('Image from accessibility issue', {
          x: margin + 10,
          y: yPosition - imageData.height - 15,
          size: 8,
          font: regularFont,
          color: rgb(0.5, 0.5, 0.5),
        });
        
        yPosition -= imageData.height + 20;
      } else if (imageFailedToLoad) {
        // Show placeholder for failed image
        yPosition -= 10;
        
        // Draw placeholder box
        currentPage.drawRectangle({
          x: margin + 10,
          y: yPosition - 30,
          width: 200,
          height: 30,
          borderColor: rgb(0.8, 0.2, 0.2),
          borderWidth: 1,
          color: rgb(1, 0.95, 0.95),
        });
        
        currentPage.drawText('[X] Image could not be loaded or unsupported format', {
          x: margin + 15,
          y: yPosition - 20,
          size: 9,
          font: regularFont,
          color: rgb(0.8, 0.2, 0.2),
        });
        
        yPosition -= 40;
      }
      
      // Help text
      if (result.help) {
        const helpLines = wrapText(`Help: ${sanitizeForPDF(result.help)}`, contentWidth, regularFont, 9);
        helpLines.forEach((line, index) => {
          currentPage.drawText(line, {
            x: margin + 10,
            y: yPosition - (index * 11),
            size: 9,
            font: regularFont,
            color: rgb(0.3, 0.3, 0.3),
          });
        });
        yPosition -= helpLines.length * 11;
      }
      
      // Element (shortened)
      if (result.element) {
        const elementText = result.element.length > 100 ? result.element.substring(0, 100) + '...' : result.element;
        const elementLines = wrapText(`Element: ${sanitizeForPDF(elementText)}`, contentWidth, regularFont, 8);
        elementLines.forEach((line, index) => {
          currentPage.drawText(line, {
            x: margin + 10,
            y: yPosition - (index * 10),
            size: 8,
            font: regularFont,
            color: rgb(0.4, 0.4, 0.4),
          });
        });
        yPosition -= elementLines.length * 10;
      }
      
      // Estimated fix time
      const fixTime = estimateFixTime(result);
      currentPage.drawText(`Estimated fix time: ${fixTime}`, {
        x: margin + 10,
        y: yPosition,
        size: 9,
        font: regularFont,
        color: rgb(0, 0.6, 0),
      });
      yPosition -= 15;
      
      // Tags
      if (result.tags && result.tags.length > 0) {
        const tagsText = `Tags: ${result.tags.join(', ')}`;
        const tagLines = wrapText(sanitizeForPDF(tagsText), contentWidth, regularFont, 8);
        tagLines.forEach((line, index) => {
          currentPage.drawText(line, {
            x: margin + 10,
            y: yPosition - (index * 10),
            size: 8,
            font: regularFont,
            color: rgb(0.5, 0, 0.5),
          });
        });
        yPosition -= tagLines.length * 10;
      }
      
      yPosition -= 10; // Space between issues
    }
    
    yPosition -= 15; // Space between URLs
  }
  
  // Footer on each page
  const pages = pdfDoc.getPages();
  pages.forEach((page, index) => {
    page.drawText(`Page ${index + 1} of ${pages.length} - Generated on ${new Date().toLocaleDateString()}`, {
      x: margin,
      y: 30,
      size: 8,
      font: regularFont,
      color: rgb(0.5, 0.5, 0.5),
    });
  });
  
  // Create export directory
  const exportDir = path.join(process.cwd(), 'exports');
  await fs.mkdir(exportDir, { recursive: true });
  
  // Save the PDF
  const filename = `accessibility-report-${Date.now()}.pdf`;
  const filePath = path.join(exportDir, filename);
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(filePath, pdfBytes);
  
  return { filePath, filename };
}
