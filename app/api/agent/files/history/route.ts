/**
 * GET  /api/agent/files/history?fileId=...  — list version history for a file
 * POST /api/agent/files/history             — rollback to a specific version
 */

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { requireWriteAuth } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"

// ─── GET: Version history ─────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get("fileId")
  const limit  = Math.min(parseInt(searchParams.get("limit") || "20"), 50)

  if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file = await (prisma as any).agentFile.findUnique({
      where:  { id: fileId },
      select: { id: true, name: true, type: true, isActive: true, updatedAt: true },
    })
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const history = await (prisma as any).agentFileHistory.findMany({
      where:   { fileId },
      select:  { id: true, version: true, content: true, savedBy: true, createdAt: true },
      orderBy: { version: "desc" },
      take:    limit,
    })

    return NextResponse.json({
      file,
      history,
      totalVersions: history.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── POST: Rollback to version ────────────────────────────────────────────────

export async function POST(req: Request) {
  const authResult = await requireWriteAuth()
  if (!authResult.ok) return authResult.response

  try {
    const body = await req.json()
    const { action, fileId, historyId } = body

    if (action !== "rollback") return NextResponse.json({ error: "action must be 'rollback'" }, { status: 400 })
    if (!fileId)    return NextResponse.json({ error: "fileId is required" }, { status: 400 })
    if (!historyId) return NextResponse.json({ error: "historyId is required" }, { status: 400 })

    // Find the history record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshot = await (prisma as any).agentFileHistory.findUnique({
      where:  { id: historyId },
      select: { id: true, content: true, version: true, fileId: true },
    })
    if (!snapshot) return NextResponse.json({ error: "History record not found" }, { status: 404 })
    if (snapshot.fileId !== fileId) return NextResponse.json({ error: "History record does not belong to this file" }, { status: 400 })

    // Get current file to snapshot it before rollback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = await (prisma as any).agentFile.findUnique({
      where:  { id: fileId },
      select: { id: true, name: true, content: true, history: { select: { version: true }, orderBy: { version: "desc" }, take: 1 } },
    })
    if (!current) return NextResponse.json({ error: "File not found" }, { status: 404 })

    // Save current state as a new history entry before rolling back
    const nextVersion = (current.history[0]?.version ?? 0) + 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).agentFileHistory.create({
      data: { fileId, content: current.content, version: nextVersion, savedBy: `rollback-backup (${authResult.email})` },
    })

    // Apply rollback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (prisma as any).agentFile.update({
      where: { id: fileId },
      data:  { content: snapshot.content },
      select: { id: true, name: true, type: true, isActive: true, updatedAt: true },
    })

    return NextResponse.json({
      success:          true,
      file:             updated,
      rolledBackTo:     snapshot.version,
      backupVersion:    nextVersion,
      message:          `Rolled back to v${snapshot.version}. Current state saved as v${nextVersion}.`,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
