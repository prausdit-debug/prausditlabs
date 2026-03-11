import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWriteAuth } from "@/lib/api-auth"

export async function POST(req: Request) {
  const auth = await requireWriteAuth()
  if (!auth.ok) return auth.response

  try {
    const body = await req.json()
    const testKey = body.apiKey

    // Use provided key or fall back to stored key
    let apiKey = testKey
    if (!apiKey) {
      const settings = await prisma.aISettings.findFirst()
      apiKey = settings?.geminiApiKey
    }
    if (!apiKey) {
      apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY
    }

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "No API key provided" })
    }

    // Test by calling Gemini list models endpoint
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: "GET" }
    )

    if (res.ok) {
      return NextResponse.json({ success: true, message: "Gemini API key is valid ✓" })
    } else {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({
        success: false,
        error: (err as Record<string, { message?: string }>).error?.message || "Invalid API key",
      })
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) })
  }
}
