/**
 * POST /api/agent/plan
 * GET  /api/agent/plan
 *
 * Human-in-the-loop plan management.
 *
 * GET  ?projectId=... → list pending plans
 * POST { action: "approve"|"reject"|"list_pending", planNoteId?, feedback? }
 *
 * FIX: Replaced bare String(err) responses with toApiError() so Prisma
 * internals are never leaked to the client.
 */

import { NextResponse }     from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { requireWriteAuth } from "@/lib/api-auth"
import { prisma }           from "@/lib/prisma"
import { toApiError }       from "@/lib/errors"

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("projectId")

  try {
    const plans = await prisma.note.findMany({
      where: {
        tags: { hasSome: ["agent-plan"] },
        ...(projectId ? { projectId } : {}),
      },
      select: {
        id: true, title: true, content: true, tags: true,
        pinned: true, projectId: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })
    return NextResponse.json({
      plans,
      pendingCount:  plans.filter((p) => p.tags.includes("pending-approval")).length,
      approvedCount: plans.filter((p) => p.tags.includes("approved")).length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: toApiError(err, "api/agent/plan GET") },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const authResult = await requireWriteAuth()
  if (!authResult.ok) return authResult.response

  const user     = await currentUser()
  const userName = user?.fullName || user?.emailAddresses?.[0]?.emailAddress || "user"

  try {
    const body = await req.json()
    const { action, planNoteId, feedback } = body

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 })
    }

    if (action === "approve") {
      if (!planNoteId) {
        return NextResponse.json({ error: "planNoteId required" }, { status: 400 })
      }
      const note = await prisma.note.findUnique({ where: { id: planNoteId } })
      if (!note) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

      await prisma.note.update({
        where: { id: planNoteId },
        data: {
          title:   note.title.replace("📋 PLAN:", "✅ APPROVED:").replace("(REVISED):", "(APPROVED):"),
          content: note.content + `\n\n---\n✅ **APPROVED** by ${userName} at ${new Date().toISOString()}`,
          tags:    ["agent-plan", "approved"],
          pinned:  false,
        },
      })
      return NextResponse.json({
        success: true, action: "approved", planNoteId,
        approvedBy: userName,
        message: "Plan approved. The agent will proceed with execution.",
      })
    }

    if (action === "reject") {
      if (!planNoteId) {
        return NextResponse.json({ error: "planNoteId required" }, { status: 400 })
      }
      const note = await prisma.note.findUnique({ where: { id: planNoteId } })
      if (!note) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

      await prisma.note.update({
        where: { id: planNoteId },
        data: {
          title:   note.title.replace("📋 PLAN:", "❌ REJECTED:"),
          content: note.content + `\n\n---\n❌ **REJECTED** by ${userName} at ${new Date().toISOString()}${feedback ? `\n**Feedback:** ${feedback}` : ""}`,
          tags:    ["agent-plan", "rejected"],
          pinned:  false,
        },
      })
      return NextResponse.json({
        success: true, action: "rejected", planNoteId,
        rejectedBy: userName, feedback,
        message: "Plan rejected.",
      })
    }

    if (action === "list_pending") {
      const pending = await prisma.note.findMany({
        where: { tags: { hasSome: ["pending-approval"] } },
        select: { id: true, title: true, projectId: true, createdAt: true, tags: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
      return NextResponse.json({ plans: pending, count: pending.length })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: toApiError(err, "api/agent/plan POST") },
      { status: 500 }
    )
  }
}
