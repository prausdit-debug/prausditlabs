"use client"

/**
 * components/chat/source-card.tsx
 *
 * Standalone source card component — Perplexity/ChatGPT style.
 * Used by SourcesList and can be imported independently.
 *
 * Features:
 * - Favicon from Google S2 (with graceful fallback)
 * - Domain + "crawled" badge
 * - Relevance score display
 * - Snippet preview (2-line clamp)
 * - Full hover state with amber accent
 * - ID anchor for citation scroll-to
 */

import { ExternalLink, Globe } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Type ─────────────────────────────────────────────────────────────────────

export interface SourceItem {
  /** 1-based display index — used for [1] citation linking */
  index:   number
  url:     string
  title:   string
  domain:  string
  snippet: string
  /** true when the agent actually crawled the page content */
  crawled: boolean
  /** 0–1 relevance score (optional) */
  score?:  number
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SourceCardProps {
  source: SourceItem
  compact?: boolean
}

export function SourceCard({ source, compact = false }: SourceCardProps) {
  return (
    <a
      id={`source-${source.index}`}
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex items-start gap-3 rounded-xl border transition-all duration-150",
        compact ? "p-2.5" : "p-3",
        "border-border/50 bg-card/40 hover:bg-card hover:border-amber-500/30",
        "hover:shadow-sm hover:shadow-amber-500/5",
        // Citation scroll highlight target — applied transiently via JS
        "transition-[border-color,background-color,box-shadow]"
      )}
    >
      {/* Index + Favicon */}
      <div className="flex-shrink-0 flex items-center gap-1.5 pt-0.5">
        <span className="text-[10px] font-bold text-muted-foreground/40 w-3 text-right tabular-nums">
          {source.index}
        </span>
        <div className="w-5 h-5 rounded-md bg-muted/60 flex items-center justify-center overflow-hidden flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=32`}
            alt=""
            width={16}
            height={16}
            className="w-4 h-4 object-contain"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = "none"
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <p className={cn(
          "font-medium text-foreground leading-snug line-clamp-1 group-hover:text-amber-400 transition-colors",
          compact ? "text-[11.5px]" : "text-[12.5px]"
        )}>
          {source.title}
        </p>

        {/* Domain row */}
        <div className="flex items-center gap-1.5 mt-0.5 mb-1">
          <Globe className="w-2.5 h-2.5 text-muted-foreground/40 flex-shrink-0" />
          <span className="text-[10px] text-muted-foreground/60 truncate max-w-[140px]">
            {source.domain}
          </span>

          {source.crawled && (
            <span className="text-[9px] px-1 py-px rounded border text-emerald-400 border-emerald-500/30 bg-emerald-500/10 flex-shrink-0">
              crawled
            </span>
          )}

          {source.score !== undefined && (
            <span className="text-[9px] text-muted-foreground/30 flex-shrink-0 ml-auto tabular-nums">
              {(source.score * 100).toFixed(0)}%
            </span>
          )}
        </div>

        {/* Snippet */}
        {source.snippet && !compact && (
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
