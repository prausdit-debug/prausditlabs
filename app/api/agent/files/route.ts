/**
 * GET  /api/agent/files    — list all agent config files
 * POST /api/agent/files    — create or update an agent file (with auto-versioning)
 */

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { requireWriteAuth } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"

// GET: List all agent files 

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const type     = searchParams.get("type")     // optional filter: system | rules | tools
    const activeOnly = searchParams.get("active") === "true"

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const files = await (prisma as any).agentFile.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      select: {
        id:        true,
        name:      true,
        type:      true,
        content:   true,
        isActive:  true,
        order:     true,
        createdAt: true,
        updatedAt: true,
        history:   { select: { id: true, version: true, savedBy: true, createdAt: true }, orderBy: { version: "desc" }, take: 1 },
      },
      orderBy: [{ type: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({
      files,
      counts: {
        total:   files.length,
        active:  (files as Array<{ isActive: boolean }>).filter((f) => f.isActive).length,
        system:  (files as Array<{ type: string }>).filter((f) => f.type === "system").length,
        rules:   (files as Array<{ type: string }>).filter((f) => f.type === "rules").length,
        tools:   (files as Array<{ type: string }>).filter((f) => f.type === "tools").length,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── POST: Create or update agent file

export async function POST(req: Request) {
  const authResult = await requireWriteAuth()
  if (!authResult.ok) return authResult.response

  try {
    const body = await req.json()
    const { id, name, type, content, isActive, order } = body

    if (!name?.trim())    return NextResponse.json({ error: "name is required" }, { status: 400 })
    if (!content?.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 })
    if (!type || !["system", "rules", "tools"].includes(type)) {
      return NextResponse.json({ error: "type must be system | rules | tools" }, { status: 400 })
    }

    // ── Safety: prevent deleting the last active system file ─────────────────
    if (type === "system" && isActive === false && id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeSystemCount = await (prisma as any).agentFile.count({ where: { type: "system", isActive: true, id: { not: id } } })
      if (activeSystemCount === 0) {
        return NextResponse.json({ error: "Cannot deactivate the last active system file. At least one must remain active." }, { status: 400 })
      }
    }

    if (id) {
      // ── UPDATE existing file with versioning ──────────────────────────────

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = await (prisma as any).agentFile.findUnique({ where: { id }, select: { id: true, content: true, history: { select: { version: true }, orderBy: { version: "desc" }, take: 1 } } })
      if (!existing) return NextResponse.json({ error: `File ${id} not found` }, { status: 404 })

      // Save version snapshot before update
      const latestVersion = (existing.history[0]?.version ?? 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).agentFileHistory.create({
        data: { fileId: id, content: existing.content, version: latestVersion + 1, savedBy: authResult.email },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await (prisma as any).agentFile.update({
        where: { id },
        data: { name, type, content, isActive: isActive ?? true, order: order ?? 0 },
      })

      return NextResponse.json({ success: true, file: updated, versionSaved: latestVersion + 1, message: `File updated. Previous version saved as v${latestVersion + 1}.` })
    } else {
      // ── CREATE new file ───────────────────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = await (prisma as any).agentFile.create({
        data: { name, type, content, isActive: isActive ?? true, order: order ?? 0 },
      })
      return NextResponse.json({ success: true, file: created, message: `File "${name}" created.` }, { status: 201 })
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── DELETE: Remove a file ────────────────────────────────────────────────────

export async function DELETE(req: Request) {
  const authResult = await requireWriteAuth()
  if (!authResult.ok) return authResult.response

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file = await (prisma as any).agentFile.findUnique({ where: { id }, select: { type: true, isActive: true } })
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })

    // Prevent deleting last active system file
    if (file.type === "system" && file.isActive) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const count = await (prisma as any).agentFile.count({ where: { type: "system", isActive: true } })
      if (count <= 1) return NextResponse.json({ error: "Cannot delete the last active system file." }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).agentFile.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "File deleted." })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
