import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        urls: true,
        scans: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })
    
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    if (!project.urls.length) {
      return NextResponse.json(
        { error: "Project has no URLs to scan" },
        { status: 400 }
      )
    }

    // Check for existing pending scans
    const pendingScans = project.scans.filter(scan => 
      scan.status === 'pending' || scan.status === 'in_progress'
    )
    
    if (pendingScans.length > 0) {
      return NextResponse.json(
        { error: "Cannot rescan while there are pending or in-progress scans. Please wait for them to complete." },
        { status: 409 }
      )
    }

    // Find or create scans for each URL
    const scanPromises = project.urls.map(async (urlRecord) => {
      // Find the latest scan for this URL
      const existingScan = project.scans.find(scan => scan.url === urlRecord.url)
      
      let scanId: string
      
      if (existingScan) {
        // Use existing scan ID for rescan
        scanId = existingScan.id
      } else {
        // Create new scan if none exists
        const newScan = await prisma.scan.create({
          data: {
            projectId: project.id,
            url: urlRecord.url,
            status: "pending"
          }
        })
        scanId = newScan.id
      }

      // Trigger scan processing asynchronously with scanId for rescan
      setTimeout(async () => {
        try {
          const scanData = {
            projectId: project.id,
            url: urlRecord.url,
            complianceOptions: project.complianceOptions || {
              wcagLevel: "aa",
              section508: false,
              bestPractices: true,
              experimental: false
            }
          }
          
          // Add scanId if this is a rescan
          if (existingScan) {
            (scanData as any).scanId = scanId
          }
          
          await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/scans`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(scanData)
          })
        } catch (error) {
          console.error(`Failed to trigger scan for ${urlRecord.url}:`, error)
        }
      }, 100)

      return {
        id: scanId,
        url: urlRecord.url,
        status: existingScan ? 'rescanning' : 'pending'
      }
    })

    const scans = await Promise.all(scanPromises)

    return NextResponse.json({ 
      success: true, 
      message: `Started rescanning ${scans.length} URLs`,
      scans
    })
  } catch (error) {
    console.error("Error rescanning project:", error)
    return NextResponse.json(
      { error: "Failed to rescan project" },
      { status: 500 }
    )
  }
} 