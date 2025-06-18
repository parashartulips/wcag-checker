import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(
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
          },
          include: {
            results: true
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

    return NextResponse.json(project)
  } catch (error) {
    console.error("Error fetching project:", error)
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { name, urls } = await request.json()

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

    // Update project name
    const project = await prisma.project.update({
      where: { id },
      data: { name },
      include: {
        urls: true,
        scans: true
      }
    })

    // Update URLs if provided
    if (urls && Array.isArray(urls)) {
      // Delete existing URLs
      await prisma.url.deleteMany({
        where: { projectId: id }
      })

      // Create new URLs
      await prisma.url.createMany({
        data: urls.map((url: string) => ({
          url,
          projectId: id
        }))
      })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error("Error updating project:", error)
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    await prisma.project.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    )
  }
} 