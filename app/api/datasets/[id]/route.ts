import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWriteAuth } from "@/lib/api-auth"

/**
 * GET /api/datasets/[id]
 * Fetch a dataset by ID — open to agents
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const dataset = await prisma.dataset.findUnique({
      where: { id }
    })

    if (!dataset) {
      return NextResponse.json(
        { error: "Dataset not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...dataset,
      sizeBytes: dataset.sizeBytes?.toString() ?? null,
    })

  } catch (error) {
    console.error("Dataset GET error:", error)

    return NextResponse.json(
      { error: "Failed to fetch dataset" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/datasets/[id]
 * Delete dataset — requires admin/developer role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWriteAuth()
  if (!auth.ok) return auth.response

  try {
    const { id } = await params

    await prisma.dataset.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: "Dataset deleted successfully"
    })

  } catch (error) {
    console.error("Dataset DELETE error:", error)

    return NextResponse.json(
      { error: "Failed to delete dataset" },
      { status: 500 }
    )
  }
  }
