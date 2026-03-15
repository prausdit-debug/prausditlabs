import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWriteAuth } from "@/lib/api-auth"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const note = await prisma.note.findUnique({ where: { id } })
    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json(note)
  } catch (error) {
    console.error("Note GET error:", error)
    return NextResponse.json({ error: "Failed to fetch note" }, { status: 500 })
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

    const note = await prisma.note.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.pinned !== undefined && { pinned: body.pinned }),
        ...(body.lastEditedByUserId !== undefined && { lastEditedByUserId: body.lastEditedByUserId }),
        ...(body.lastEditedByUserName !== undefined && { lastEditedByUserName: body.lastEditedByUserName }),
        lastEditedAt: new Date(),
        ...(body.editedWithAIModel && { editedWithAIModel: body.editedWithAIModel }),
      },
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error("Note PATCH error:", error)
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 })
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
    await prisma.note.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Note DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 })
  }
}

