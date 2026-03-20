/**
 * POST /api/agent/workflow
 *
 * Trigger autonomous agentic workflows programmatically.
 * Used by the CRM UI to auto-trigger agent actions on events like:
 *   - Dataset uploaded → dataset_intelligence workflow
 *   - Experiment completed → documentation_automation workflow
 *   - User marks roadmap milestone → roadmap_autopilot workflow
 *   - Model version created → model_benchmark workflow
 *
 * Body:
 *   { workflow: WorkflowType, payload: Record<string, unknown>, provider?: string, model?: string }
 *
 * FIXES:
 *  - Removed duplicated getSuperAdminEmail() and inline role check.
 *    Now uses requireWriteAuth() from lib/api-auth (single source of truth).
 *    requireWriteAuth() already handles super_admin email bypass + DB role lookup.
 */

import { NextResponse }    from "next/server"
import { runWorkflow }     from "@/lib/agent-engine"
import { requireWriteAuth } from "@/lib/api-auth"

export const maxDuration = 120

const ALLOWED_WORKFLOWS = [
  "documentation_automation",
  "roadmap_autopilot",
  "experiment_planning",
  "research_autopilot",
  "dataset_intelligence",
  "model_benchmark",
] as const

type WorkflowType = typeof ALLOWED_WORKFLOWS[number]

export async function POST(req: Request) {
  try {
    // requireWriteAuth() handles: session check, super_admin email bypass,
    // DB role lookup, and 401/403/503 responses — no duplication needed here.
    const authResult = await requireWriteAuth()
    if (!authResult.ok) return authResult.response

    const body = await req.json()
    const { workflow, payload = {}, provider = "gemini", model = "gemini-2.5-flash" } = body

    if (!workflow || !ALLOWED_WORKFLOWS.includes(workflow as WorkflowType)) {
      return NextResponse.json(
        { error: `Invalid workflow. Must be one of: ${ALLOWED_WORKFLOWS.join(", ")}` },
        { status: 400 }
      )
    }

    const stream = runWorkflow(
      workflow as WorkflowType,
      payload,
      { history: [], provider, model }
    )

    return new Response(stream, {
      headers: {
        "Content-Type":    "text/event-stream",
        "Cache-Control":   "no-cache",
        "Connection":      "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Workflow-Type": workflow,
      },
    })
  } catch (err) {
    console.error("[/api/agent/workflow] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    availableWorkflows: ALLOWED_WORKFLOWS,
    description:
      "POST with { workflow, payload, provider?, model? } to trigger an autonomous agent workflow",
  })
}
