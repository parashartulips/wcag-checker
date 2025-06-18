import { NextResponse } from "next/server"
import { getScanResults } from "@/lib/scan-actions"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "10")
    const sortBy = searchParams.get("sortBy") || "severity"
    const search = searchParams.get("search") || ""
    const severityFilters = searchParams.get("severityFilters")?.split(",") || []
    const complianceFilters = searchParams.get("complianceFilters")?.split(",") || []

    const results = await getScanResults(
      id,
      page,
      pageSize,
      sortBy,
      search,
      severityFilters,
      complianceFilters
    )

    return NextResponse.json(results)
  } catch (error) {
    console.error("Error getting scan results:", error)
    return NextResponse.json(
      { error: "Failed to get scan results" },
      { status: 500 }
    )
  }
} 