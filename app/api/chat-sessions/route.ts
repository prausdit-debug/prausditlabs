/**
 * GET  /api/chat-sessions  — list sessions (role-gated)
 * POST /api/chat-sessions  — create session
 *
 * FIXES:
 *  - Removed duplicated getSuperAdminEmail() — now imported from lib/api-auth
 *    (single source of truth).
 *  - resolveUser() replaced with getEffectiveUser() from lib/api-auth.
 */

import { NextResponse }           from "next/server"
import { auth, currentUser }      from "@clerk/nextjs/server"
import { prisma, isDatabaseConfigured } from "@/lib/prisma"
import { getEffectiveUser }        from "@/lib/api-auth"

const ALLOWED_ROLES = new Set(["super_admin", "admin", "developer"])
const PAGE_SIZE = 30

export async function GET(req: Request) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({
        sessions: [],
        total:    0,
        page:     1,
        pageSize: PAGE_SIZE,
        warning:  "Database not configured. Chat sessions require a database connection.",
      })
    }

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const actor = await getEffectiveUser()
    if (!actor || !ALLOWED_ROLES.has(actor.role)) {
      return NextResponse.json(
        { error: "Access denied. This feature is restricted to internal developers." },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const skip = (page - 1) * PAGE_SIZE

    const where =
      actor.role === "super_admin"
        ? {}
        : actor.role === "admin"
        ? {
            OR: [
              { visibility: "team"    as const },
              { creatorId: userId, visibility: "private" as const },
            ],
          }
        : {
            OR: [
              { visibility: "team" as const },
              { creatorId: userId },
            ],
          }

    const [sessions, total] = await Promise.all([
      prisma.chatSession.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: PAGE_SIZE,
        select: {
          id: true, title: true, creatorId: true, creatorName: true,
          visibility: true, createdAt: true, updatedAt: true,
          _count: { select: { messages: true } },
        },
      }),
      prisma.chatSession.count({ where }),
    ])

    return NextResponse.json({ sessions, total, page, pageSize: PAGE_SIZE })
  } catch (err) {
    console.error("[/api/chat-sessions GET] Error:", {
      message: err instanceof Error ? err.message : String(err),
      stack:   err instanceof Error ? err.stack   : undefined,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        { error: "Database not configured. Chat sessions require a database connection." },
        { status: 503 }
      )
    }

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const actor = await getEffectiveUser()
    if (!actor || !ALLOWED_ROLES.has(actor.role)) {
      return NextResponse.json(
        { error: "Access denied. This feature is restricted to internal developers." },
        { status: 403 }
      )
    }

    // Get the DB user for name display — currentUser() gives us Clerk data
    const clerkUser  = await currentUser()
    const creatorName = clerkUser?.fullName
      || clerkUser?.emailAddresses[0]?.emailAddress
      || "Unknown"

    const { title, visibility, projectId } = await req.json().catch(() => ({}))

    const session = await prisma.chatSession.create({
      data: {
        title:       title?.trim() || "New Chat",
        creatorId:   userId,
        creatorName,
        visibility:  visibility === "private" ? "private" : "team",
        projectId:   projectId || null,
      },
    })

    return NextResponse.json(session)
  } catch (err) {
    console.error("[/api/chat-sessions POST] Error:", {
      message: err instanceof Error ? err.message : String(err),
      stack:   err instanceof Error ? err.stack   : undefined,
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
