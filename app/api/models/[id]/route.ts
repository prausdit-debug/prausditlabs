import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWriteAuth } from "@/lib/api-auth"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const model = await prisma.modelVersion.findUnique({
      where: { id },
      include: { experiment: { select: { name: true } } },
    })
    if (!model) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({
      ...model,
      parameterCount: model.parameterCount?.toString() ?? null,
      fileSizeBytes: model.fileSizeBytes?.toString() ?? null,
    })
  } catch (error) {
    console.error("Model GET error:", error)
    return NextResponse.json({ error: "Failed to fetch model" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWriteAuth()
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const body = await req.json()

    const model = await prisma.modelVersion.update({
      where: { id },
      data: {
        ...(body.isDeployed !== undefined && { isDeployed: body.isDeployed }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.pass1Score !== undefined && { pass1Score: Number(body.pass1Score) }),
        ...(body.bleuScore !== undefined && { bleuScore: Number(body.bleuScore) }),
        ...(body.lastEditedByUserId !== undefined && { lastEditedByUserId: body.lastEditedByUserId }),
        ...(body.lastEditedByUserName !== undefined && { lastEditedByUserName: body.lastEditedByUserName }),
        lastEditedAt: new Date(),
        ...(body.editedWithAIModel && { editedWithAIModel: body.editedWithAIModel }),
      },
      include: { experiment: { select: { name: true } } },
    })

    return NextResponse.json({
      ...model,
      parameterCount: model.parameterCount?.toString() ?? null,
      fileSizeBytes: model.fileSizeBytes?.toString() ?? null,
    })
  } catch (error) {
    console.error("Model PATCH error:", error)
    return NextResponse.json({ error: "Failed to update model" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWriteAuth()
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    await prisma.modelVersion.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Model DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete model" }, { status: 500 })
  }
}

