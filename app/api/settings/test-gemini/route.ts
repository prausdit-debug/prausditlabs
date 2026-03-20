/**
 * POST /api/settings/test-gemini
 *
 * Tests whether the stored or provided Gemini API key is valid.
 *
 * FIX: When reading the stored key from the DB, it must be decrypted
 * with decryptKey() first (keys are now stored AES-256-GCM encrypted).
 * String(err) leak in catch block replaced with safe error response.
 */

import { NextResponse }     from "next/server"
import { prisma }           from "@/lib/prisma"
import { requireWriteAuth } from "@/lib/api-auth"
import { decryptKey }       from "@/lib/crypto"

export async function POST(req: Request) {
  const auth = await requireWriteAuth()
  if (!auth.ok) return auth.response

  try {
    const body    = await req.json()
    const testKey = body.apiKey as string | undefined

    // Priority: provided key → stored (decrypted) DB key → env var
    let apiKey: string | null | undefined = testKey

    if (!apiKey) {
      const settings = await prisma.aISettings.findFirst()
      // FIX: decrypt the stored key before using it
      apiKey = settings?.geminiApiKey ? decryptKey(settings.geminiApiKey) : null
    }

    if (!apiKey) {
      apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY
    }

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "No Gemini API key provided" })
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: "GET", signal: AbortSignal.timeout(8000) }
    )

    if (res.ok) {
      return NextResponse.json({ success: true, message: "Gemini API key is valid ✓" })
    }

    const err = await res.json().catch(() => ({}))
    return NextResponse.json({
      success: false,
      error: (err as Record<string, { message?: string }>).error?.message || "Invalid API key",
    })
  } catch {
    // FIX: Do not return String(err) — it can leak internal details
    return NextResponse.json({ success: false, error: "Connection to Gemini API failed" })
  }
}
