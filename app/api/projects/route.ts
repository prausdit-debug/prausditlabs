import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma, isDatabaseConfigured } from "@/lib/prisma"

// GET /api/projects - List all projects
export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json([])
  }

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
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

    return NextResponse.json(projects)
  } catch (err) {
    console.error("GET /api/projects error:", err)
    return NextResponse.json([], { status: 200 })
  }
}

// POST /api/projects - Create a new project
export async function POST(req: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user from database
    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user has permission (admin or super_admin)
    if (!["admin", "super_admin"].includes(user.role)) {
      return NextResponse.json({ error: "Permission denied. Only Admin or Super Admin can create projects." }, { status: 403 })
    }

    const body = await req.json()
    const { name, type, description, config } = body

    if (!name || !type) {
      return NextResponse.json({ error: "Name and type are required" }, { status: 400 })
    }

    const validTypes = ["MODEL", "FRONTEND", "BACKEND", "CUSTOM"]
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid project type" }, { status: 400 })
    }

    const project = await prisma.project.create({
      data: {
        name,
        type,
        description: description || null,
        config: config || null,
        createdById: user.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json(project)
  } catch (err) {
    console.error("POST /api/projects error:", err)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}
