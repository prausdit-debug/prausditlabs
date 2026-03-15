import { NextResponse } from "next/server"
import { prisma, isDatabaseConfigured } from "@/lib/prisma"
import { requireWriteAuth } from "@/lib/api-auth"

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json([])
  }

  try {
    // Get projectId from query params
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    const notes = await prisma.note.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { updatedAt: "desc" },
    })
    return NextResponse.json(notes)
  } catch (error) {
    console.error("Notes GET error:", error)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  const auth = await requireWriteAuth()
  if (!auth.ok) return auth.response

  try {
    const body = await req.json()
    if (!body.title || !body.content) {
      return NextResponse.json({ error: "title and content are required" }, { status: 400 })
    }
    const note = await prisma.note.create({
      data: {
        title: body.title,
        content: body.content,
        tags: body.tags || [],
        pinned: body.pinned || false,
        projectId: body.projectId || null,
        createdByUserId: body.createdByUserId || null,
        createdByUserName: body.createdByUserName || null,
        createdWithAIModel: body.createdWithAIModel || null,
      },
    })
    return NextResponse.json(note)
  } catch (error) {
    console.error("Notes POST error:", error)
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 })
  }
}

