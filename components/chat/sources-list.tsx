"use client"

/**
 * components/chat/sources-list.tsx
 *
 * Perplexity-style sources section rendered below assistant messages.
 *
 * Extraction supports all three search tool shapes:
 *  - crawl_web         → single {url, title, content, error}
 *  - research          → {results: SearchResultRaw[], provider, ...}
 *  - run_research_autopilot → same shape as research
 *
 * Features:
 * - Collapsible section (collapsed/expanded toggle)
 * - "Show N more" progressive disclosure (max 3 visible by default)
 * - ID anchors on each card for [N] citation scroll-to-source
 * - Deduplication by URL across all steps
 */

import { useState } from "react"
import { Globe, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { SourceCard } from "@/components/chat/source-card"
import type { SourceItem } from "@/components/chat/source-card"
import type { AgentStep } from "@/types/agent"

// ─── Re-export SourceItem type so callers can import from either file ─────────
export type { SourceItem }

// ─── Internal types ───────────────────────────────────────────────────────────

interface SearchResultRaw {
  url:      string
  title?:   string
  snippet?: string
  content?: string
  score?:   number
}

interface ResearchResultRaw {
  results?:  SearchResultRaw[]
  sources?:  string[]
  provider?: string
  error?:    string
}

const SEARCH_TOOLS = new Set(["research", "crawl_web", "run_research_autopilot"])

// ─── Source extraction ────────────────────────────────────────────────────────

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * Walk all agent steps and extract unique web sources.
 * Returns a deduped, indexed array of SourceItem.
 */
export function extractSources(steps: AgentStep[]): SourceItem[] {
  const seen    = new Set<string>()
  const sources: SourceItem[] = []
  let   idx     = 0

  for (const step of steps) {
    if (step.type !== "tool_result" || !step.tool) continue
    if (!SEARCH_TOOLS.has(step.tool))               continue

    const raw = step.result as Record<string, unknown> | null
    if (!raw) continue

    // ── crawl_web → single page ────────────────────────────────────────────
    if (step.tool === "crawl_web") {
      const url    = raw.url     as string | undefined
      const title  = raw.title   as string | undefined
      const body   = raw.content as string | undefined
      const err    = raw.error   as string | undefined

      if (url && !err && !seen.has(url)) {
        seen.add(url)
        sources.push({
          index:   ++idx,
          url,
          title:   title || getHostname(url),
          domain:  getHostname(url),
          snippet: body
            ? body.slice(0, 180).replace(/\s+/g, " ").trimEnd() +
              (body.length > 180 ? "…" : "")
            : "",
          crawled: true,
        })
      }
      continue
    }

    // ── research / run_research_autopilot → result list ────────────────────
    const r = raw as unknown as ResearchResultRaw
    if (!r.results?.length) continue

    const crawledSet = new Set(
      r.results.filter((x) => x.content).map((x) => x.url)
    )

    for (const res of r.results) {
      if (!res.url || seen.has(res.url)) continue
      seen.add(res.url)
      sources.push({
        index:   ++idx,
        url:     res.url,
        title:   res.title || getHostname(res.url),
        domain:  getHostname(res.url),
        snippet: res.snippet ||
          (res.content
            ? res.content.slice(0, 180).replace(/\s+/g, " ").trimEnd() + "…"
            : ""),
        crawled: crawledSet.has(res.url),
        score:   res.score,
      })
    }
  }

  return sources
}

// ─── SourcesList ──────────────────────────────────────────────────────────────

interface SourcesListProps {
  steps:      AgentStep[]
  className?: string
  /** Override the initial collapsed/expanded state (default: expanded) */
  defaultExpanded?: boolean
  /** How many sources to show before "Show N more" (default: 3) */
  previewCount?: number
}

export function SourcesList({
  steps,
  className,
  defaultExpanded = true,
  previewCount    = 3,
}: SourcesListProps) {
  const sources = extractSources(steps)

  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showAll,  setShowAll]  = useState(false)

  if (sources.length === 0) return null

  const visible = showAll ? sources : sources.slice(0, previewCount)
  const hasMore  = sources.length > previewCount
  const hidden   = sources.length - previewCount

  return (
    <div className={cn("mt-4", className)}>
      {/* ── Section header ──────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 mb-2.5 w-full group"
      >
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-amber-400/80" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Sources
          </span>
          <span className="text-[10px] text-muted-foreground/50 font-mono">
            ({sources.length})
          </span>
        </div>

        {/* Divider */}
        <div className="flex-1 h-px bg-border/50" />

        {expanded
          ? <ChevronUp   className="w-3 h-3 text-muted-foreground/40" />
          : <ChevronDown className="w-3 h-3 text-muted-foreground/40" />
        }
      </button>

      {/* ── Card grid ───────────────────────────────────────────────────── */}
      {expanded && (
        <>
          <div className="grid grid-cols-1 gap-2">
            {visible.map((source) => (
              <SourceCard
                key={`${source.url}-${source.index}`}
                source={source}
              />
            ))}
          </div>

          {/* Show more / Show less */}
          {hasMore && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className={cn(
                "mt-2 w-full flex items-center justify-center gap-1.5",
                "text-[11px] text-amber-400/70 hover:text-amber-400 transition-colors",
                "py-1.5 rounded-lg border border-dashed border-amber-500/20",
                "hover:border-amber-500/40 hover:bg-amber-500/5"
              )}
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Show fewer sources
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  {hidden} more source{hidden !== 1 ? "s" : ""}
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  )
}
