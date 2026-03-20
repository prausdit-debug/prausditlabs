/**
 * types/agent.ts — Shared types for the agent system.
 *
 * Previously AgentStep was defined as a private interface inside
 * chatbot-widget.tsx. Extracting it here allows other components
 * (step viewers, history panels, etc.) to import it without
 * redefining it.
 */
export interface AgentStep {
  id:     string
  type:   "tool_call" | "tool_result" | "status" | "text"
  text:   string
  tool?:  string
  args?:  Record<string, unknown>
  result?: unknown
  step?:  number
}
