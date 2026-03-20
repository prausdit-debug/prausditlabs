/**
 * types/chat.ts — Shared chat system types, models, and constants.
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * Previously every type/constant below was declared as a private file-scoped
 * symbol inside components/chatbot/chatbot-widget.tsx. When
 * app/(dashboard)/chat/page.tsx (the fullscreen chat) was added it needed the
 * same types — but couldn't import them because they weren't exported.
 *
 * This caused the build-blocking TypeScript error:
 *   "Cannot find name 'AgentStep'"  (and 9 siblings)
 *
 * Fix: everything shared lives here. Both files import from "@/types/chat".
 *
 * ─── IMPORT PATTERN ──────────────────────────────────────────────────────────
 *   import type { ChatModel, ChatSession, Message, RoutingMode } from "@/types/chat"
 *   import { GEMINI_MODELS, AUTO_ROUTING_MODELS, SLASH_COMMANDS }  from "@/types/chat"
 */

// ─── Re-export AgentStep from the canonical location ─────────────────────────
export type { AgentStep } from "./agent"
import type { AgentStep } from "./agent"

// ─── SSE streaming event types ───────────────────────────────────────────────

export type AgentEventType =
  | "text"
  | "status"
  | "tool_call"
  | "tool_result"
  | "done"
  | "error"
  | "project_switch"

export interface AgentEvent {
  type:         AgentEventType
  text?:        string
  tool?:        string
  args?:        Record<string, unknown>
  result?:      unknown
  step?:        number
  projectId?:   string
  projectName?: string
}

// ─── Chat message ─────────────────────────────────────────────────────────────

export interface Message {
  id:                string
  role:              "user" | "assistant"
  content:           string
  loading?:          boolean
  agentSteps?:       AgentStep[]
  stepsExpanded?:    boolean
  reasoning?:        string
  reasoningExpanded?: boolean
  modelId?:          string
}

// ─── Model ────────────────────────────────────────────────────────────────────

export interface ChatModel {
  id:        string
  name:      string
  provider:  "gemini" | "openrouter"
  shortName: string
  /** True for OpenRouter free-tier models (display badge only) */
  free?:     boolean
}

/**
 * RoutingMode — used to track whether the user has selected a real model
 * manually or one of the auto-routing pseudo-models.
 */
export type RoutingMode = "manual" | "auto" | "auto-free" | "auto-paid"

// ─── Chat session ─────────────────────────────────────────────────────────────

export interface ChatSession {
  id:           string
  title:        string
  creatorId:    string
  creatorName?: string
  visibility:   "team" | "private"
  createdAt:    string
  updatedAt:    string
  _count?:      { messages: number }
}

// ─── Gemini model catalogue ───────────────────────────────────────────────────
// Keep in sync with settings/page.tsx GEMINI_CHAT_MODELS when adding models.

export const GEMINI_MODELS: ChatModel[] = [
  { id: "gemini-2.5-flash",      name: "Gemini 2.5 Flash",      provider: "gemini", shortName: "2.5 Flash"  },
  { id: "gemini-2.5-pro",        name: "Gemini 2.5 Pro",        provider: "gemini", shortName: "2.5 Pro"    },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", provider: "gemini", shortName: "2.5 Lite"   },
  { id: "gemini-2.5-flash-live", name: "Gemini 2.5 Flash Live", provider: "gemini", shortName: "2.5 Live"   },
]

// ─── Auto-routing pseudo-models ───────────────────────────────────────────────
// Presented in the model picker as "smart routing" options.
// The sendMessage handler resolves them to a real model ID before calling /api/agent.

export const AUTO_ROUTING_MODELS: ChatModel[] = [
  {
    id:        "auto",
    name:      "Auto (Best Available)",
    provider:  "openrouter",
    shortName: "Auto",
    free:      false,
  },
  {
    id:        "auto-free",
    name:      "Auto (Free Models Only)",
    provider:  "openrouter",
    shortName: "Auto Free",
    free:      true,
  },
  {
    id:        "auto-paid",
    name:      "Auto (Premium Models)",
    provider:  "openrouter",
    shortName: "Auto Paid",
    free:      false,
  },
]

// ─── Slash commands ───────────────────────────────────────────────────────────

export const SLASH_COMMANDS: { cmd: string; desc: string }[] = [
  { cmd: "/document",   desc: "Create a documentation page" },
  { cmd: "/roadmap",    desc: "Add a roadmap step"           },
  { cmd: "/experiment", desc: "Design an experiment"         },
  { cmd: "/dataset",    desc: "Register a dataset"           },
  { cmd: "/note",       desc: "Save a research note"         },
]
