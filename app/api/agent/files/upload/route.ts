/**
 * POST /api/agent/files/upload
 *
 * Upload a .md file → read content → create AgentFile entry.
 * Accepts multipart/form-data with a "file" field (.md only).
 * Also accepts JSON body with { name, type, content } for direct upload.
 */

import { NextResponse } from "next/server"
import { requireWriteAuth } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { toApiError } from "@/lib/errors"

const MAX_FILE_SIZE = 512 * 1024  // 512 KB
const ALLOWED_TYPES = ["system", "rules", "tools"]

export async function POST(req: Request) {
  const authResult = await requireWriteAuth()
  if (!authResult.ok) return authResult.response

  try {
    const contentType = req.headers.get("content-type") || ""

    // ── Path A: multipart/form-data (actual file upload) ─────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const file = formData.get("file") as File | null
      const type = (formData.get("type") as string) || "rules"
      const name = formData.get("name") as string | null

      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
      if (!file.name.endsWith(".md")) return NextResponse.json({ error: "Only .md files are allowed" }, { status: 400 })
      if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: `File too large. Max ${MAX_FILE_SIZE / 1024}KB.` }, { status: 400 })
      if (!ALLOWED_TYPES.includes(type)) return NextResponse.json({ error: "type must be system | rules | tools" }, { status: 400 })

      const content = await file.text()
      if (!content.trim()) return NextResponse.json({ error: "File is empty" }, { status: 400 })

      const fileName = name?.trim() || file.name.replace(".md", "").replace(/-/g, " ").replace(/_/g, " ")
      const created = await prisma.agentFile.create({
        data: { name: fileName, type, content, isActive: true, order: 0 },
      })

      return NextResponse.json({
        success:  true,
        file:     created,
        fileName: file.name,
        size:     file.size,
        message:  `"${fileName}" uploaded and activated.`,
      }, { status: 201 })
    }

    // ── Path B: JSON body { name, type, content } ─────────────────────────────
    const body = await req.json()
    const { name, type = "rules", content } = body

    if (!name?.trim())    return NextResponse.json({ error: "name is required" }, { status: 400 })
    if (!content?.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 })
    if (!ALLOWED_TYPES.includes(type)) return NextResponse.json({ error: "type must be system | rules | tools" }, { status: 400 })
    if (content.length > MAX_FILE_SIZE) return NextResponse.json({ error: "Content too large" }, { status: 400 })
    const created = await prisma.agentFile.create({
      data: { name, type, content, isActive: true, order: 0 },
    })

    return NextResponse.json({
      success: true,
      file:    created,
      message: `"${name}" created and activated.`,
    }, { status: 201 })

  } catch (err) {
    return NextResponse.json({ error: toApiError(err) }, { status: 500 })
  }
}
