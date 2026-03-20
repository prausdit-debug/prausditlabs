"use client"

import { Cpu, Globe } from "lucide-react"

/**
 * ModelBadge — tiny icon that visually identifies the AI provider.
 *
 * Extracted from chatbot-widget.tsx so both the embedded widget and the
 * fullscreen chat page (app/(dashboard)/chat/page.tsx) can share it
 * without redeclaring or copy-pasting.
 */
export function ModelBadge({ provider }: { provider: "gemini" | "openrouter" }) {
  return provider === "gemini"
    ? <Cpu  className="w-3 h-3 text-amber-400" aria-label="Gemini"      />
    : <Globe className="w-3 h-3 text-blue-400"  aria-label="OpenRouter"  />
}
