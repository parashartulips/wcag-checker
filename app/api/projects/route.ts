import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const { name, urls, complianceOptions } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      )
    }

    // Enforce URL limit
    if (urls && Array.isArray(urls) && urls.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 URLs allowed per project for performance reasons" },
        { status: 400 }
      )
    }

    // Create project with URLs if provided
    const project = await prisma.project.create({
      data: {
        name,
        complianceOptions: complianceOptions || null,
        urls: urls && urls.length > 0 ? {
          connectOrCreate: urls.map((url: string) => ({
            where: { url },
            create: { url }
          }))
        } : undefined
      },
      include: {
        urls: true,
        scans: true
      }
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        urls: true,
        scans: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error("Error fetching projects:", error)
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    )
  }
} 