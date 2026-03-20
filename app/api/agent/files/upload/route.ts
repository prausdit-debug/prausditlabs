/**
 * POST /api/agent/files/upload
 *
 * Upload a .md file → read content → create AgentFile entry.
 * Accepts multipart/form-data with a "file" field (.md only).
 * Also accepts JSON body with { name, type, content } for direct upload.
 *
 * ─── FIX ─────────────────────────────────────────────────────────────────────
 * Both code paths previously passed a raw `string` as `type` into
 * `prisma.agentFile.create({ data: { type, ... } })`.
 *
 * Prisma v7 with strict TypeScript requires `AgentFileType` (the enum),
 * not a plain `string`. The fix:
 *   - Define `AgentFileType` locally as `"system" | "rules" | "tools"` (matches
 *     the Prisma schema exactly and is structurally compatible with the generated enum).
 *   - Use `parseAgentFileType()` to validate and narrow the raw string value
 *     before it ever reaches a Prisma call.
 */

import { NextResponse }      from "next/server"
import { requireWriteAuth }  from "@/lib/api-auth"
import { prisma }            from "@/lib/prisma"
import { toApiError }        from "@/lib/errors"

// ─── Enum mirror (matches prisma/schema.prisma AgentFileType) ─────────────────

const AGENT_FILE_TYPES = ["system", "rules", "tools"] as const
type  AgentFileType     = typeof AGENT_FILE_TYPES[number]

/** Returns the validated AgentFileType, or null if the raw value is invalid. */
function parseAgentFileType(raw: string | null | undefined): AgentFileType | null {
  if (!raw) return null
  return (AGENT_FILE_TYPES as readonly string[]).includes(raw)
    ? (raw as AgentFileType)
    : null
}

const MAX_FILE_SIZE = 512 * 1024  // 512 KB

export async function POST(req: Request) {
  const authResult = await requireWriteAuth()
  if (!authResult.ok) return authResult.response

  try {
    const contentType = req.headers.get("content-type") || ""

    // ── Path A: multipart/form-data (actual .md file upload) ─────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const file     = formData.get("file") as File | null
      const rawType  = (formData.get("type") as string | null) ?? "rules"
      const name     = formData.get("name") as string | null

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 })
      }
      if (!file.name.endsWith(".md")) {
        return NextResponse.json({ error: "Only .md files are allowed" }, { status: 400 })
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File too large. Max ${MAX_FILE_SIZE / 1024} KB.` },
          { status: 400 }
        )
      }

      // ── Validate and narrow type ──────────────────────────────────────────
      const fileType = parseAgentFileType(rawType)
      if (!fileType) {
        return NextResponse.json(
          { error: `type must be one of: ${AGENT_FILE_TYPES.join(" | ")}` },
          { status: 400 }
        )
      }

      const content = await file.text()
      if (!content.trim()) {
        return NextResponse.json({ error: "File is empty" }, { status: 400 })
      }

      const fileName =
        name?.trim() ||
        file.name
          .replace(/\.md$/i, "")
          .replace(/-/g, " ")
          .replace(/_/g, " ")

      const created = await prisma.agentFile.create({
        data: { name: fileName, type: fileType, content, isActive: true, order: 0 },
      })

      return NextResponse.json(
        {
          success:  true,
          file:     created,
          fileName: file.name,
          size:     file.size,
          message:  `"${fileName}" uploaded and activated.`,
        },
        { status: 201 }
      )
    }

    // ── Path B: JSON body { name, type, content } ─────────────────────────────
    const body = await req.json()
    const { name, content } = body
    const rawType: unknown   = body.type ?? "rules"

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }
    if (!content?.trim()) {
      return NextResponse.json({ error: "content is required" }, { status: 400 })
    }
    if (content.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Content too large" }, { status: 400 })
    }

    // ── Validate and narrow type ──────────────────────────────────────────────
    const fileType = parseAgentFileType(
      typeof rawType === "string" ? rawType : null
    )
    if (!fileType) {
      return NextResponse.json(
        { error: `type must be one of: ${AGENT_FILE_TYPES.join(" | ")}` },
        { status: 400 }
      )
    }

    const created = await prisma.agentFile.create({
      data: { name, type: fileType, content, isActive: true, order: 0 },
    })

    return NextResponse.json(
      { success: true, file: created, message: `"${name}" created and activated.` },
      { status: 201 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: toApiError(err, "agent/files/upload POST") },
      { status: 500 }
    )
  }
}
