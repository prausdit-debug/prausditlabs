/**
 * POST /api/agent/files/toggle
 *
 * Enable or disable an AgentFile.
 * Safety: prevents disabling the last active system file.
 *
 * Body: { id: string, isActive?: boolean }
 * If isActive is omitted, toggles the current state.
 */

import { NextResponse } from "next/server"
import { requireWriteAuth } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { toApiError } from "@/lib/errors"

export async function POST(req: Request) {
  const authResult = await requireWriteAuth()
  if (!authResult.ok) return authResult.response

  try {
    const body = await req.json()
    const { id, isActive } = body

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    const file = await prisma.agentFile.findUnique({
      where:  { id },
      select: { id: true, name: true, type: true, isActive: true },
    })
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 })

    const newState = typeof isActive === "boolean" ? isActive : !file.isActive

    // ── Safety: at least one system file must stay active ─────────────────────
    if (file.type === "system" && !newState) {
      const activeCount = await prisma.agentFile.count({
        where: { type: "system", isActive: true, id: { not: id } },
      })
      if (activeCount === 0) {
        return NextResponse.json({
          error: "Cannot deactivate the last active system file. At least one system file must remain active.",
          currentState: file.isActive,
        }, { status: 400 })
      }
    }
    const updated = await prisma.agentFile.update({
      where: { id },
      data:  { isActive: newState },
    })

    return NextResponse.json({
      success:      true,
      id:           updated.id,
      name:         updated.name,
      isActive:     updated.isActive,
      previousState: file.isActive,
      message:      `"${file.name}" ${newState ? "activated" : "deactivated"}.`,
    })
  } catch (err) {
    return NextResponse.json({ error: toApiError(err) }, { status: 500 })
  }
}
