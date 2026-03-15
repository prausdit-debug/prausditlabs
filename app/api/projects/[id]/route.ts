import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma, isDatabaseConfigured } from "@/lib/prisma"

// GET /api/projects/[id] - Get a single project
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: {
            datasets: true,
            experiments: true,
            documentation: true,
            roadmapSteps: true,
            notes: true,
            modelVersions: true,
            chatSessions: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (err) {
    console.error("GET /api/projects/[id] error:", err)
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 })
  }
}

// PATCH /api/projects/[id] - Update a project
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user || !["admin", "super_admin"].includes(user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()

    const project = await prisma.project.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        config: body.config,
        updatedAt: new Date(),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json(project)
  } catch (err) {
    console.error("PATCH /api/projects/[id] error:", err)
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
}

// DELETE /api/projects/[id] - Delete a project
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user || !["admin", "super_admin"].includes(user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { id } = await params

    await prisma.project.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/projects/[id] error:", err)
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}
