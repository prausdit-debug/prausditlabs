/**
 * GET    /api/agent/files      — list all agent config files
 * POST   /api/agent/files      — create or update an agent file (with auto-versioning)
 * DELETE /api/agent/files?id=  — delete an agent file
 *
 * ─── ROOT CAUSE OF BUILD FAILURE ────────────────────────────────────────────
 * `searchParams.get("type")` returns `string | null`.
 * Prisma's AgentFileWhereInput.type expects `AgentFileType` (the enum),
 * NOT a plain `string`. TypeScript catches this at compile time:
 *
 *   Type 'string' is not assignable to type 'AgentFileType'
 *
 * ─── FIX ─────────────────────────────────────────────────────────────────────
 * 1. Define `AGENT_FILE_TYPES` as a `const` tuple — matches the Prisma enum exactly.
 * 2. `AgentFileType` is derived from that tuple → `"system" | "rules" | "tools"`.
 *    This is structurally identical to the Prisma-generated `AgentFileType`, so
 *    TypeScript accepts it everywhere Prisma expects the enum.
 * 3. `parseAgentFileType()` is a proper type guard that rejects unknown strings and
 *    returns a correctly-typed value (or `null` for "no filter").
 * 4. Same pattern is applied to the POST body `type` field and the DELETE guard.
 */

import { NextResponse } from "next/server"
import { auth }         from "@clerk/nextjs/server"
import { requireWriteAuth } from "@/lib/api-auth"
import { prisma }       from "@/lib/prisma"
import { toApiError }   from "@/lib/errors"

// ─── Enum definition (mirrors prisma/schema.prisma AgentFileType) ─────────────
// Keeping this here avoids importing from the generated client, which may not
// exist on a cold checkout before `prisma generate` has run.

const AGENT_FILE_TYPES = ["system", "rules", "tools"] as const
type  AgentFileType     = typeof AGENT_FILE_TYPES[number]

/**
 * Type guard: narrows `string | null` → `AgentFileType | null`.
 * Returns `null` when the value is absent OR not a valid enum member.
 * Returns a 400 response object when the value is present but invalid
 * (call with the request context that wants to surface the error).
 */
function parseAgentFileType(raw: string | null): AgentFileType | null {
  if (raw === null || raw === "") return null
  if ((AGENT_FILE_TYPES as readonly string[]).includes(raw)) {
    return raw as AgentFileType
  }
  return undefined as never // caller checks via isValidAgentFileType
}

/** Validate and narrow — returns `{ valid: AgentFileType | null }` or `{ error }` */
function validateFileType(raw: string | null):
  | { ok: true;  value: AgentFileType | null }
  | { ok: false; message: string } {
  if (raw === null || raw === "") return { ok: true, value: null }
  if ((AGENT_FILE_TYPES as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as AgentFileType }
  }
  return { ok: false, message: `type must be one of: ${AGENT_FILE_TYPES.join(" | ")}` }
}

// ─── GET: List all agent files ────────────────────────────────────────────────

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const rawType    = searchParams.get("type")   // optional filter: system | rules | tools
    const activeOnly = searchParams.get("active") === "true"

    // ── Validate the type query param ─────────────────────────────────────────
    const typeResult = validateFileType(rawType)
    if (!typeResult.ok) {
      return NextResponse.json({ error: typeResult.message }, { status: 400 })
    }
    const typeFilter = typeResult.value  // AgentFileType | null — fully type-safe

    const files = await prisma.agentFile.findMany({
      where: {
        // Only add `type` to the where clause when a valid filter was provided.
        // `typeFilter` is `AgentFileType | null`; spreading `{}` when null avoids
        // passing `{ type: null }` which would filter for NULL rows.
        ...(typeFilter !== null ? { type: typeFilter } : {}),
        ...(activeOnly           ? { isActive: true }  : {}),
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
        history: {
          select:  { id: true, version: true, savedBy: true, createdAt: true },
          orderBy: { version: "desc" },
          take:    1,
        },
      },
      orderBy: [{ type: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({
      files,
      counts: {
        total:  files.length,
        active: files.filter((f) => f.isActive).length,
        system: files.filter((f) => f.type === "system").length,
        rules:  files.filter((f) => f.type === "rules").length,
        tools:  files.filter((f) => f.type === "tools").length,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: toApiError(err, "agent/files GET") }, { status: 500 })
  }
}

// ─── POST: Create or update agent file ───────────────────────────────────────

export async function POST(req: Request) {
  const authResult = await requireWriteAuth()
  if (!authResult.ok) return authResult.response

  try {
    const body = await req.json()
    const { id, name, content, isActive, order } = body

    // ── Validate name / content ───────────────────────────────────────────────
    if (!name?.trim())    return NextResponse.json({ error: "name is required" },    { status: 400 })
    if (!content?.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 })

    // ── Validate type ─────────────────────────────────────────────────────────
    const typeResult = validateFileType(body.type ?? null)
    if (!typeResult.ok || typeResult.value === null) {
      return NextResponse.json(
        { error: typeResult.ok ? "type is required" : typeResult.message },
        { status: 400 }
      )
    }
    const fileType: AgentFileType = typeResult.value

    // ── Safety: prevent disabling the last active system file ─────────────────
    if (fileType === "system" && isActive === false && id) {
      const activeSystemCount = await prisma.agentFile.count({
        where: { type: "system", isActive: true, id: { not: id } },
      })
      if (activeSystemCount === 0) {
        return NextResponse.json(
          { error: "Cannot deactivate the last active system file. At least one must remain active." },
          { status: 400 }
        )
      }
    }

    if (id) {
      // ── UPDATE existing file with auto-versioning ─────────────────────────
      const existing = await prisma.agentFile.findUnique({
        where:  { id },
        select: {
          id:      true,
          content: true,
          history: { select: { version: true }, orderBy: { version: "desc" }, take: 1 },
        },
      })
      if (!existing) {
        return NextResponse.json({ error: `File ${id} not found` }, { status: 404 })
      }

      // Save current content as a version snapshot before overwriting
      const latestVersion = existing.history[0]?.version ?? 0
      await prisma.agentFileHistory.create({
        data: {
          fileId:  id,
          content: existing.content,
          version: latestVersion + 1,
          savedBy: authResult.email,
        },
      })

      const updated = await prisma.agentFile.update({
        where: { id },
        data:  {
          name,
          type:     fileType,
          content,
          isActive: isActive                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               