import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const step = await prisma.roadmapStep.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.title && { title: body.title }),
        ...(body.description && { description: body.description }),
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
  try {
    const { id } = await params
    await prisma.roadmapStep.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Roadmap step DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete roadmap step" }, { status: 500 })
  }
}

