/**
 * POST /api/agent
 *
 * Agentic chat endpoint powered by the Vercel AI SDK.
 * Now accepts `currentProjectId` from the client and forwards it to
 * the agent engine for project-scoped tool injection.
 * Auth: Requires a Clerk session.
 */

import { NextResponse } from "next/server"
import { requireWriteAuth } from "@/lib/api-auth"
import { runAgent } from "@/lib/agent-engine"

export const maxDuration = 120

export async function POST(req: Request) {
  const authResult = await requireWriteAuth()
  if (!authResult.ok) return authResult.response

  try {
    const body = await req.json()
    const {
      message,
      history = [],
      provider = "gemini",
      model = "gemini-2.5-flash",
      currentProjectId,   // project context from UI
      sessionMemory,      // Fix 3: session entity memory digest from UI
    } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const stream = runAgent({
      message: message.trim(),
      history,
      provider,
      model,
      currentProjectId: currentProjectId || null,
      sessionMemory: sessionMemory || null,
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (err) {
    console.error("[/api/agent] Route error:", err)
    const msg = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
