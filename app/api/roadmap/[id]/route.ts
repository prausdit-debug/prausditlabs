import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWriteAuth } from "@/lib/api-auth"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const step = await prisma.roadmapStep.findUnique({
      where: { id },
      include: { tasks: true },
    })
    if (!step) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json(step)
  } catch (error) {
    console.error("Roadmap step GET error:", error)
    return NextResponse.json({ error: "Failed to fetch roadmap step" }, { status: 500 })
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

    const step = await prisma.roadmapStep.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.title && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.milestone !== undefined && { milestone: body.milestone }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.lastEditedByUserId !== undefined && { lastEditedByUserId: body.lastEditedByUserId }),
        ...(body.lastEditedByUserName !== undefined && { lastEditedByUserName: body.lastEditedByUserName }),
        lastEditedAt: new Date(),
        ...(body.editedWithAIModel && { editedWithAIModel: body.editedWithAIModel }),
      },
      include: { tasks: true },
    })

    return NextResponse.json(step)
  } catch (error) {
    console.error("Roadmap step PATCH error:", error)
    return NextResponse.json({ error: "Failed to update roadmap step" }, { status: 500 })
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
    await prisma.roadmapStep.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Roadmap step DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete roadmap step" }, { status: 500 })
  }
}

