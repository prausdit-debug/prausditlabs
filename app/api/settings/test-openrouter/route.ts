/**
 * POST /api/settings/test-openrouter
 *
 * Tests whether the stored or provided OpenRouter API key is valid.
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
      apiKey = settings?.openrouterApiKey ? decryptKey(settings.openrouterApiKey) : null
    }

    if (!apiKey) {
      apiKey = process.env.OPENROUTER_API_KEY
    }

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "No OpenRouter API key provided" })
    }

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok) {
      const data  = await res.json()
      const count = data?.data?.length ?? 0
      return NextResponse.json({
        success: true,
        message: `OpenRouter API key valid ✓ (${count} models available)`,
      })
    }

    return NextResponse.json({ success: false, error: "Invalid OpenRouter API key" })
  } catch {
    // FIX: Do not return String(err) — it can leak internal details
    return NextResponse.json({ success: false, error: "Connection to OpenRouter API failed" })
  }
}
