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
 * PATCH /api/datasets/[id]
 * Update dataset — requires admin/developer role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWriteAuth()
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const body = await request.json()

    const dataset = await prisma.dataset.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.sourceUrl !== undefined && { sourceUrl: body.sourceUrl }),
        ...(body.format !== undefined && { format: body.format }),
        ...(body.license !== undefined && { license: body.license }),
        ...(body.preprocessStatus && { preprocessStatus: body.preprocessStatus }),
        lastEditedByUserId: body.lastEditedByUserId || null,
        lastEditedByUserName: body.lastEditedByUserName || null,
        lastEditedAt: new Date(),
        ...(body.editedWithAIModel && { editedWithAIModel: body.editedWithAIModel }),
      },
    })

    return NextResponse.json({
      ...dataset,
      sizeBytes: dataset.sizeBytes?.toString() || null,
    })
  } catch (error) {
    console.error("Dataset PATCH error:", error)
    return NextResponse.json({ error: "Failed to update dataset" }, { status: 500 })
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
