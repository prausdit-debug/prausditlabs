/**
 * lib/research-engine.ts
 *
 * DEPRECATED — this file is intentionally replaced by lib/agent-tools.ts.
 *
 * WHY IT WAS REMOVED:
 *  1. This file only read API keys from process.env — it completely ignored
 *     keys saved through the Settings UI (stored in the DB AISettings table).
 *     agent-tools.ts correctly reads from DB first, then env vars as fallback.
 *
 *  2. It still referenced BRAVE_API_KEY (dead variable — Brave was replaced
 *     by Exa) while agent-tools.ts uses Exa correctly.
 *
 *  3. The agent only ever calls the `research` tool in agent-tools.ts.
 *     This file was never imported anywhere in the final codebase.
 *
 * If you need to call deep research outside of agent tools, import from agent-tools:
 *
 *   import { researchTool } from "@/lib/agent-tools"
 *
 * Or call the /api/agent endpoint with a research message.
 *
 * This file is kept as a stub to avoid breaking any import that might
 * reference it, but all exports are re-exported from agent-tools.ts.
 */

// Re-export the canonical types from agent-tools so any import of
// ResearchResult / DeepResearchOutput from this file still compiles.
export type { ResearchResult, DeepResearchOutput } from "./agent-tools"

// Note: deepResearch() is not exported from agent-tools (it's an internal function).
// If you need programmatic deep research, trigger it via:
//   POST /api/agent  { message: "research: <topic>", ... }
