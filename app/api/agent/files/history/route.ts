/**
 * GET  /api/agent/files/history?fileId=...  — list version history for a file
 * POST /api/agent/files/history             — rollback to a specific version
 *
 * No enum issues in this file — all Prisma where clauses use `id` (string PK)
 * and `fileId` (string FK), which are plain strings, not enum fields.
 * Included here for completeness as part of the full agent-files API surface.
 */

import { NextResponse }     from "next/server"
import { auth }             from "@clerk/nextjs/server"
import { requireWriteAuth } from "@/lib/api-auth"
import { prisma }           from "@/lib/prisma"
import { toApiError }       from "@/lib/errors"

// ─── GET: Version history for a file ─────────────────────────────────────────

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get("fileId")
  const limit  = Math.min(parseInt(searchParams.get("limit") || "20"), 50)

  if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 })

  try {
    const file = await prisma.agentFile.findUnique({
      where:  { id: fileId },
      select: { id: true, name: true, type: true, isActive: true, updatedAt: true },
    })
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })

    const history = await prisma.agentFileHistory.findMany({
      where:   { fileId },
      select:  { id: true, version: true, content: true, savedBy: true, createdAt: true },
      orderBy: { version: "desc" },
      take:    limit,
    })

    return NextResponse.json({ file, history, totalVersions: history.length })
  } catch (err) {
    return NextResponse.json(
      { error: toApiError(err, "agent/files/history GET") },
      { status: 500 }
    )
  }
}

// ─── POST: Rollback to a specific version ────────────────────────────────────

export async function POST(req: Request) {
  const authResult = await requireWriteAuth()
  if (!authResult.ok) return authResult.response

  try {
    const body = await req.json()
    const { action, fileId, historyId } = body

    if (action !== "rollback") {
      return NextResponse.json({ error: "action must be 'rollback'" }, { status: 400 })
    }
    if (!fileId)    return NextResponse.json({ error: "fileId is required"   }, { status: 400 })
    if (!historyId) return NextResponse.json({ error: "historyId is required" }, { status: 400 })

    // Fetch the history snapshot we are rolling back to
    const snapshot = await prisma.agentFileHistory.findUnique({
      where:  { id: historyId },
      select: { id: true, content: true, version: true, fileId: true },
    })
    if (!snapshot) {
      return NextResponse.json({ error: "History record not found" }, { status: 404 })
    }
    if (snapshot.fileId !== fileId) {
      return NextResponse.json(
        { error: "History record does not belong to this file" },
        { status: 400 }
      )
    }

    // Fetch current file so we can snapshot it before overwriting
    const current = await prisma.agentFile.findUnique({
      where:  { id: fileId },
      select: {
        id:      true,
        name:    true,
        content: true,
        history: { select: { version: true }, orderBy: { version: "desc" }, take: 1 },
      },
    })
    if (!current) return NextResponse.json({ error: "File not found" }, { status: 404 })

    // Save current state as a new history entry before rolling back
    const nextVersion = (current.history[0]?.version ?? 0) + 1
    await prisma.agentFileHistory.create({
      data: {
        fileId,
        content: current.content,
        version: nextVersion,
        savedBy: `rollback-backup (${authResult.email})`,
      },
    })

    // Apply the rollback
    const updated = await prisma.agentFile.update({
      where:  { id: fileId },
      data:   { content: snapshot.content },
      select: { id: true, name: true, type: true, isActive: true, updatedAt: true },
    })

    return NextResponse.json({
      success:       true,
      file:          updated,
      rolledBackTo:  snapshot.version,
      backupVersion: nextVersion,
      message:       `Rolled back to v${snapshot.version}. Current state saved as v${nextVersion}.`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: toApiError(err, "agent/files/history POST") },
      { status: 500 }
    )
  }
}
