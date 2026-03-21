"use client"

/**
 * components/chat/sources-list.tsx
 *
 * Extracts web search sources from agentSteps and renders them as
 * a Perplexity/Claude-style citations section below assistant messages.
 *
 * Source extraction logic:
 *  - step.type === "tool_result" + tool in SEARCH_TOOLS
 *  - For "research" / "run_research_autopilot": step.result.results[]
 *  - For "crawl_web": step.result as single {url, title, content}
 *
 * Design: Compact numbered cards with favicon, title, domain, snippet.
 * Matches the UX pattern of ChatGPT citations + Perplexity source cards.
 */

import { useState } from "react"
import { ExternalLink, Globe, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentStep } from "@/types/agent"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SourceItem {
  index:   number
  url:     string
  title:   string
  domain:  string
  snippet: string
  crawled: boolean
  score?:  number
}

interface SearchResultRaw {
  url:      string
  title?:   string
  snippet?: string
  content?: string
  score?:   number
}

interface ResearchResultRaw {
  results?:   SearchResultRaw[]
  sources?:   string[]
  provider?:  string
  error?:     string
}

const SEARCH_TOOLS = new Set(["research", "crawl_web", "run_research_autopilot"])

// ─── Source extraction ────────────────────────────────────────────────────────

function getHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "") }
  catch { return url }
}

export function extractSources(steps: AgentStep[]): SourceItem[] {
  const seen = new Set<string>()
  const sources: SourceItem[] = []
  let idx = 0

  for (const step of steps) {
    if (step.type !== "tool_result" || !step.tool) continue
    if (!SEARCH_TOOLS.has(step.tool)) continue

    const raw = step.result as Record<string, unknown> | null
    if (!raw) continue

    // crawl_web — single page result
    if (step.tool === "crawl_web") {
      const url   = raw.url   as string | undefined
      const title = raw.title as string | undefined
      const body  = raw.content as string | undefined
      const err   = raw.error  as string | undefined
      if (url && !err && !seen.has(url)) {
        seen.add(url)
        sources.push({
          index:   ++idx,
          url,
          title:   title || getHostname(url),
          domain:  getHostname(url),
          snippet: body ? body.slice(0, 160).replace(/\n/g, " ") + (body.length > 160 ? "…" : "") : "",
          crawled: true,
        })
      }
      continue
    }

    // research / run_research_autopilot
    const r = raw as unknown as ResearchResultRaw
    if (!r.results?.length) continue

    const crawledSet = new Set(
      r.results.filter(x => x.content).map(x => x.url)
    )

    for (const res of r.results) {
      if (!res.url || seen.has(res.url)) continue
      seen.add(res.url)
      sources.push({
        index:   ++idx,
        url:     res.url,
        title:   res.title || getHostname(res.url),
        domain:  getHostname(res.url),
        snippet: res.snippet || (res.content ? res.content.slice(0, 160).replace(/\n/g, " ") + "…" : ""),
        crawled: crawledSet.has(res.url),
        score:   res.score,
      })
    }
  }

  return sources
}

// ─── Individual source card ───────────────────────────────────────────────────

function SourceCard({ source }: { source: SourceItem }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex items-start gap-3 p-3 rounded-xl border transition-all duration-150",
        "border-border/50 bg-card/40 hover:bg-card hover:border-amber-500/30",
        "hover:shadow-sm hover:shadow-amber-500/5"
      )}
    >
      {/* Index + Favicon */}
      <div className="flex-shrink-0 flex items-center gap-1.5 pt-0.5">
        <span className="text-[10px] font-bold text-muted-foreground/40 w-3 text-right">
          {source.index}
        </span>
        <div className="w-5 h-5 rounded-md bg-muted/60 flex items-center justify-center overflow-hidden flex-shrink-0">
          <img
            src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=32`}
            alt=""
            className="w-4 h-4 object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <p className="text-[12.5px] font-medium text-foreground leading-snug line-clamp-1 group-hover:text-amber-400 transition-colors">
          {source.title}
        </p>
        {/* Domain + badges */}
        <div className="flex items-center gap-1.5 mt-0.5 mb-1">
          <Globe className="w-2.5 h-2.5 text-muted-foreground/40 flex-shrink-0" />
          <span className="text-[10px] text-muted-foreground/60 truncate">{source.domain}</span>
          {source.crawled && (
            <span className="text-[9px] px-1 py-px rounded border text-emerald-400 border-emerald-500/30 bg-emerald-500/10 flex-shrink-0">
              crawled
            </span>
          )}
          {source.score !== undefined && (
            <span className="text-[9px] text-muted-foreground/30 flex-shrink-0 ml-auto">
              {(source.score * 100).toFixed(0)}%
            </span>
          )}
        </div>
        {/* Snippet */}
        {source.snippet && (
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-2">
            {source.snippet}
          </p>
        )}
      </div>

      {/* External link icon */}
      <ExternalLink className="w-3 h-3 text-muted-foreground/30 flex-shrink-0 mt-1 group-hover:text-amber-400/60 transition-colors" />
    </a>
  )
}

// ─── Sources list (main export) ───────────────────────────────────────────────

interface SourcesListProps {
  steps:     AgentStep[]
  className?: string
}

export function SourcesList({ steps, className }: SourcesListProps) {
  const sources = extractSources(steps)
  const [expanded, setExpanded] = useState(true)
  const [showAll, setShowAll]   = useState(false)

  if (sources.length === 0) return null

  const PREVIEW_COUNT = 3
  const visible = showAll ? sources : sources.slice(0, PREVIEW_COUNT)
  const hasMore  = sources.length > PREVIEW_COUNT

  return (
    <div className={cn("mt-4", className)}>
      {/* Section header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 mb-2.5 group w-full"
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
        <div className="flex-1 h-px bg-border/50" />
        {expanded
          ? <ChevronUp className="w-3 h-3 text-muted-foreground/40" />
          : <ChevronDown className="w-3 h-3 text-muted-foreground/40" />
        }
      </button>

      {/* Source cards */}
      {expanded && (
        <>
          <div className="grid grid-cols-1 gap-2">
            {visible.map(source => (
              <SourceCard key={source.url + source.index} source={source} />
            ))}
          </div>

          {/* Show more / less */}
          {hasMore && (
            <button
              onClick={() => setShowAll(v => !v)}
              className={cn(
                "mt-2 w-full flex items-center justify-center gap-1.5",
                "text-[11px] text-amber-400/70 hover:text-amber-400 transition-colors",
                "py-1.5 rounded-lg border border-dashed border-amber-500/20 hover:border-amber-500/40",
                "hover:bg-amber-500/5"
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
                  {sources.length - PREVIEW_COUNT} more source{sources.length - PREVIEW_COUNT !== 1 ? "s" : ""}
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  )
}
