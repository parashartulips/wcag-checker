import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { analyzeAccessibility as simpleAnalyze } from "@/lib/simple-checker"
import { analyzeAccessibility as playwrightAnalyze } from "@/lib/playwright-axe"
import { analyzeAccessibility as htmlAnalyze } from "@/lib/html-validator"
import type { ComplianceOptions } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const { projectId, url, complianceOptions, scanId } = await request.json()

    if (!projectId || !url) {
      return NextResponse.json(
        { error: "Project ID and URL are required" },
        { status: 400 }
      )
    }

    let scan
    
    if (scanId) {
      // This is a rescan - we'll implement proper diff logic
      console.log(`Rescan requested for scan ${scanId}`)
      
      // Update the existing scan
      scan = await prisma.scan.update({
        where: { id: scanId },
        data: {
          status: "in_progress",
          url,
          startedAt: new Date(),
          completedAt: null,
          error: null,
          totalIssues: null,
          criticalIssues: null,
          seriousIssues: null,
          moderateIssues: null,
          minorIssues: null,
          analysisMethod: null
        }
      })
    } else {
      // Create new scan record
      scan = await prisma.scan.create({
        data: {
          projectId,
          url,
          status: "in_progress",
          startedAt: new Date()
        }
      })
    }

    // Process the scan asynchronously
    processScan(scan.id, url, complianceOptions || {
      wcagLevel: "aa",
      section508: false,
      bestPractices: true,
      experimental: false
    }, !!scanId).catch(error => {
      console.error(`Error processing scan ${scan.id}:`, error)
      // Update scan status to failed
      prisma.scan.update({
        where: { id: scan.id },
        data: { 
          status: "failed",
          completedAt: new Date(),
          error: error instanceof Error ? error.message : "Unknown error"
        }
      }).catch(console.error)
    })

    return NextResponse.json(scan)
  } catch (error) {
    console.error("Error creating scan:", error)
    return NextResponse.json(
      { error: "Failed to create scan" },
      { status: 500 }
    )
  }
}

async function processScan(scanId: string, url: string, complianceOptions: ComplianceOptions, isRescan: boolean = false) {
  console.log(`Starting scan processing for scanId: ${scanId}, url: ${url}, isRescan: ${isRescan}`)
  
  try {
    let analysisResult
    let analysisMethod = 'unknown'

    // Try Simple Checker first (most reliable)
    try {
      console.log(`Attempting Simple Checker analysis for ${url}`)
      analysisResult = await simpleAnalyze(url, complianceOptions)
      analysisMethod = 'simple'
      console.log(`Simple Checker succeeded for ${url}, found ${analysisResult.results.length} issues`)
    } catch (simpleError) {
      console.log(`Simple Checker failed for ${url}:`, simpleError)
      
      // Fallback to Playwright
      try {
        console.log(`Attempting Playwright analysis for ${url}`)
        analysisResult = await playwrightAnalyze(url, {
          ...complianceOptions,
          captureScreenshots: false // Disable screenshots for faster processing
        })
        analysisMethod = 'playwright'
        console.log(`Playwright succeeded for ${url}, found ${analysisResult.results.length} issues`)
      } catch (playwrightError) {
        console.log(`Playwright failed for ${url}:`, playwrightError)
        
        // Final fallback to HTML validator
        try {
          console.log(`Attempting HTML validator analysis for ${url}`)
          analysisResult = await htmlAnalyze(url, complianceOptions)
          analysisMethod = 'html-validator'
          console.log(`HTML validator succeeded for ${url}, found ${analysisResult.results.length} issues`)
        } catch (htmlError) {
          console.error(`All analysis methods failed for ${url}:`, htmlError)
          throw new Error(`All analysis methods failed: Simple: ${simpleError}, Playwright: ${playwrightError}, HTML: ${htmlError}`)
        }
      }
    }

    if (isRescan) {
      // Implement proper diff logic for rescans
      await handleRescanDiff(scanId, analysisResult.results)
    } else {
      // Save results to database for new scans
      console.log(`Saving ${analysisResult.results.length} results to database for scan ${scanId}`)
      if (analysisResult.results.length > 0) {
        await prisma.result.createMany({
          data: analysisResult.results.map(result => ({
            scanId,
            url: result.url,
            message: result.message,
            element: result.element,
            severity: result.severity,
            impact: result.impact,
            help: result.help,
            tags: result.tags,
            elementPath: result.elementPath,
            details: result.details || {},
            createdAt: new Date(result.createdAt)
          }))
        })
        console.log(`Successfully saved ${analysisResult.results.length} results for scan ${scanId}`)
      } else {
        console.log(`No results to save for scan ${scanId}`)
      }
    }

    // Update scan status to completed with summary data
    await prisma.scan.update({
      where: { id: scanId },
      data: { 
        status: "completed",
        completedAt: new Date(),
        totalIssues: analysisResult.summary.total,
        criticalIssues: analysisResult.summary.critical,
        seriousIssues: analysisResult.summary.serious,
        moderateIssues: analysisResult.summary.moderate,
        minorIssues: analysisResult.summary.minor,
        analysisMethod
      }
    })
    console.log(`Updated scan ${scanId} status to completed`)

  } catch (error) {
    console.error(`Error processing scan ${scanId}:`, error)
    
    // Update scan status to failed
    await prisma.scan.update({
      where: { id: scanId },
      data: { 
        status: "failed",
        completedAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown error"
      }
    })
    
    throw error
  }
}

async function handleRescanDiff(scanId: string, newResults: any[]) {
  console.log(`Handling rescan diff for scan ${scanId} with ${newResults.length} new results`)
  
  try {
    // Get existing results for this scan
    const existingResults = await prisma.result.findMany({
      where: { scanId }
    })
    
    console.log(`Found ${existingResults.length} existing results for scan ${scanId}`)
    
    // Create unique keys for comparison
    // We'll use a combination of url + message + element + severity as the unique identifier
    const createKey = (result: any) => `${result.url}|${result.message}|${result.element || ''}|${result.severity}`
    
    // Create maps for efficient comparison
    const existingMap = new Map<string, any>()
    existingResults.forEach(result => {
      const key = createKey(result)
      existingMap.set(key, result)
    })
    
    const newMap = new Map<string, any>()
    newResults.forEach(result => {
      const key = createKey(result)
      newMap.set(key, result)
    })
    
    // Find issues to add (in new results but not in existing)
    const toAdd: any[] = []
    newMap.forEach((result, key) => {
      if (!existingMap.has(key)) {
        toAdd.push(result)
      }
    })
    
    // Find issues to remove (in existing but not in new results)
    const toRemove: string[] = []
    existingMap.forEach((result, key) => {
      if (!newMap.has(key)) {
        toRemove.push(result.id)
      }
    })
    
    // Find issues to update (exist in both but may have changed details)
    const toUpdate: { id: string, updates: any }[] = []
    existingMap.forEach((existingResult, key) => {
      if (newMap.has(key)) {
        const newResult = newMap.get(key)!
        
        // Check if any important fields have changed
        const fieldsToCheck = ['help', 'impact', 'tags', 'elementPath', 'details']
        let hasChanges = false
        const updates: any = {}
        
        for (const field of fieldsToCheck) {
          if (JSON.stringify(existingResult[field]) !== JSON.stringify(newResult[field])) {
            updates[field] = newResult[field]
            hasChanges = true
          }
        }
        
        if (hasChanges) {
          updates.updatedAt = new Date()
          toUpdate.push({ id: existingResult.id, updates })
        }
      }
    })
    
    console.log(`Rescan diff summary:`)
    console.log(`- Issues to add: ${toAdd.length}`)
    console.log(`- Issues to remove: ${toRemove.length}`)
    console.log(`- Issues to update: ${toUpdate.length}`)
    
    // Perform database operations in transaction
    await prisma.$transaction(async (tx) => {
      // Remove resolved issues
      if (toRemove.length > 0) {
        await tx.result.deleteMany({
          where: {
            id: { in: toRemove }
          }
        })
        console.log(`Removed ${toRemove.length} resolved issues`)
      }
      
      // Add new issues
      if (toAdd.length > 0) {
        await tx.result.createMany({
          data: toAdd.map(result => ({
            scanId,
            url: result.url,
            message: result.message,
            element: result.element,
            severity: result.severity,
            impact: result.impact,
            help: result.help,
            tags: result.tags,
            elementPath: result.elementPath,
            details: result.details || {},
            createdAt: new Date(result.createdAt)
          }))
        })
        console.log(`Added ${toAdd.length} new issues`)
      }
      
      // Update existing issues with changes
      for (const update of toUpdate) {
        await tx.result.update({
          where: { id: update.id },
          data: update.updates
        })
      }
      if (toUpdate.length > 0) {
        console.log(`Updated ${toUpdate.length} existing issues`)
      }
    })
    
    console.log(`Rescan diff completed successfully for scan ${scanId}`)
    
  } catch (error) {
    console.error(`Error handling rescan diff for scan ${scanId}:`, error)
    throw error
  }
} 