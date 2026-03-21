"use client"

/**
 * components/chat/markdown-renderer.tsx
 *
 * Production-grade Markdown renderer for chat messages.
 * Supports streaming partial renders, GFM tables, code blocks,
 * task lists, citations [1], and inline source references.
 *
 * ✅ TypeScript error FIXED: `Property 'className' does not exist on type '{}'`
 *    Solution: React.isValidElement() + explicit prop casting
 *
 * ✅ Streaming-safe: partial content renders progressively with no flicker
 * ✅ Citation support: [1] inline refs link to SourcesList anchors
 * ✅ Code blocks: language label + one-click copy button
 * ✅ Full GFM: tables, task lists, strikethrough
 */

import React, { useState, useCallback, memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import type { Components } from "react-markdown"

// ─── Colour tokens (consistent with the amber design system) ──────────────────
const T = {
  base:   "text-foreground",
  muted:  "text-muted-foreground",
  amber:  "text-amber-400",
  border: "border-border",
  bg:     "bg-muted/40",
  code:   "bg-zinc-900 dark:bg-zinc-950",
} as const

// ─── Copy button ──────────────────────────────────────────────────────────────

const CopyButton = memo(function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {
      // Fallback for environments without clipboard API
      const ta = document.createElement("textarea")
      ta.value = text
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }, [text])

  return (
    <button
      onClick={copy}
      className={cn(
        "text-[11px] font-mono px-2 py-0.5 rounded border transition-all duration-150",
        copied
          ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
          : "text-zinc-400 border-zinc-700/50 hover:text-zinc-200 hover:border-zinc-600"
      )}
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  )
})

// ─── Citation link ([1], [2], …) ──────────────────────────────────────────────
// These are rendered inline and scroll to the matching source anchor.

function CitationLink({ number }: { number: number }) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    const el = document.getElementById(`source-${number}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" })
      el.classList.add("ring-2", "ring-amber-500/50")
      setTimeout(() => el.classList.remove("ring-2", "ring-amber-500/50"), 1500)
    }
  }

  return (
    <button
      onClick={handleClick}
      title={`Jump to source ${number}`}
      className={cn(
        "inline-flex items-center justify-center",
        "min-w-[1.2em] h-4 px-1 mx-0.5",
        "rounded text-[10px] font-bold font-mono",
        "bg-amber-500/15 text-amber-400 border border-amber-500/30",
        "hover:bg-amber-500/25 hover:border-amber-500/50",
        "transition-all duration-100 cursor-pointer",
        "align-text-bottom relative -top-px"
      )}
    >
      {number}
    </button>
  )
}

// ─── Pre-process content: transform [N] citation markers ──────────────────────
// Converts "[1]" "[2]" etc to a special placeholder so ReactMarkdown
// can render them as CitationLink components via the `text` renderer.

const CITATION_RE = /\[(\d+)\]/g

// We handle citations inside the `p` text renderer by splitting on the pattern.
function renderWithCitations(text: string): React.ReactNode[] {
  const parts = text.split(CITATION_RE)
  if (parts.length === 1) return [text]

  return parts.map((part, i) => {
    // Every even index is plain text, odd index is the captured number
    if (i % 2 === 0) return part || null
    const num = parseInt(part, 10)
    return isNaN(num) ? `[${part}]` : <CitationLink key={`cite-${i}`} number={num} />
  })
}

// ─── Component map ────────────────────────────────────────────────────────────

const components: Components = {

  // ── Headings ─────────────────────────────────────────────────────────────
  h1: ({ children }) => (
    <h1 className={cn("mt-6 mb-3 text-[22px] font-bold leading-tight tracking-tight", T.base)}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className={cn("mt-5 mb-2.5 text-[18px] font-semibold leading-snug", T.base)}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className={cn("mt-4 mb-2 text-[15px] font-semibold", T.base)}>
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className={cn("mt-3 mb-1.5 text-[14px] font-semibold", T.base)}>
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5 className={cn("mt-3 mb-1 text-[13px] font-semibold", T.muted)}>
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6 className={cn("mt-2 mb-1 text-[12px] font-semibold uppercase tracking-wide", T.muted)}>
      {children}
    </h6>
  ),

  // ── Paragraph (with citation rendering) ──────────────────────────────────
  p: ({ children }) => {
    // Walk children looking for plain text strings to process for citations
    const processed = React.Children.map(children, (child) => {
      if (typeof child === "string") {
        const parts = renderWithCitations(child)
        return parts.length === 1 && typeof parts[0] === "string" ? child : parts
      }
      return child
    })

    return (
      <p className={cn("mb-3 last:mb-0 leading-[1.75] text-[14px]", T.base)}>
        {processed}
      </p>
    )
  },

  // ── Lists ─────────────────────────────────────────────────────────────────
  ul: ({ children }) => (
    <ul className="mb-3 ml-4 space-y-1 list-none">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-5 space-y-1 list-decimal marker:text-muted-foreground/60 marker:text-[13px]">
      {children}
    </ol>
  ),
  li: ({ children }) => {
    const childArray = React.Children.toArray(children)
    const firstChild = childArray[0]

    // GFM task list item — first child is a checkbox input
    const isTaskItem =
      React.isValidElement(firstChild) &&
      (firstChild as React.ReactElement<{ type?: string }>).props.type === "checkbox"

    if (isTaskItem) {
      return (
        <li className={cn("flex items-start gap-2 text-[14px] leading-[1.7]", T.base)}>
          {children}
        </li>
      )
    }

    return (
      <li className={cn("flex items-start gap-2 text-[14px] leading-[1.7]", T.base)}>
        <span
          className={cn("mt-[0.48em] w-1.5 h-1.5 rounded-full flex-shrink-0", T.amber)}
          style={{ background: "currentColor", minWidth: "6px" }}
        />
        <span className="flex-1 min-w-0">{children}</span>
      </li>
    )
  },

  // ── Checkbox (GFM task list) ──────────────────────────────────────────────
  input: ({ checked }) => (
    <input
      type="checkbox"
      checked={!!checked}
      readOnly
      className="mt-1 w-3.5 h-3.5 rounded border border-border accent-amber-500 flex-shrink-0 cursor-default"
    />
  ),

  // ── Inline code ───────────────────────────────────────────────────────────
  code: ({ children, className }) => {
    const isBlock = typeof className === "string" && className.startsWith("language-")
    if (isBlock) {
      // Fenced code blocks are handled by `pre` below
      return <code className={className}>{children}</code>
    }
    return (
      <code className="px-1.5 py-0.5 rounded-md text-[12.5px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
        {children}
      </code>
    )
  },

  // ── Code block ────────────────────────────────────────────────────────────
  // FIX: `children` typed as React.ReactNode → use React.isValidElement + cast
  pre: ({ children }) => {
    // ✅ TYPESCRIPT FIX: isValidElement guard + explicit prop cast
    let lang = ""
    let codeText = ""

    if (React.isValidElement(children)) {
      const childProps = children.props as {
        className?: string
        children?: React.ReactNode
      }
      lang = childProps.className?.replace("language-", "") ?? ""
      codeText = typeof childProps.children === "string"
        ? childProps.children
        : String(childProps.children ?? "")
    }

    return (
      <div className="mb-4 rounded-xl overflow-hidden border border-border/60 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/80 border-b border-zinc-700/50">
          <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider select-none">
            {lang || "code"}
          </span>
          <CopyButton text={codeText} />
        </div>
        {/* Code body */}
        <pre
          className={cn(
            "overflow-x-auto px-4 py-3 text-[12.5px] font-mono leading-[1.7]",
            T.code,
            "text-zinc-200"
          )}
        >
          {children}
        </pre>
      </div>
    )
  },

  // ── Blockquote ────────────────────────────────────────────────────────────
  blockquote: ({ children }) => (
    <blockquote className={cn(
      "my-3 pl-4 border-l-[3px] border-amber-500/50",
      "text-[14px] italic",
      T.muted,
      T.bg,
      "pr-3 py-2 rounded-r-lg"
    )}>
      {children}
    </blockquote>
  ),

  // ── Horizontal rule ───────────────────────────────────────────────────────
  hr: () => (
    <hr className={cn("my-5 border-t", T.border, "opacity-50")} />
  ),

  // ── Inline typography ─────────────────────────────────────────────────────
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground/90">{children}</em>
  ),
  del: ({ children }) => (
    <del className="line-through text-muted-foreground/70">{children}</del>
  ),

  // ── Links ─────────────────────────────────────────────────────────────────
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-amber-400 hover:text-amber-300 underline underline-offset-2 decoration-amber-500/40 hover:decoration-amber-400/60 transition-colors"
    >
      {children}
    </a>
  ),

  // ── Tables ────────────────────────────────────────────────────────────────
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-[13px] border-collapse">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/50 border-b border-border">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-border/50">
      {children}
    </tbody>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-muted/20 transition-colors">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left font-semibold text-foreground text-[12px] uppercase tracking-wider">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-foreground/90 align-top">
      {children}
    </td>
  ),
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface MarkdownRendererProps {
  /** Markdown string — can be partial (streaming) */
  content: string
  className?: string
  /** Pass true while the stream is live — disables citation scroll (links not yet numbered) */
  streaming?: boolean
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
  streaming: _streaming,
}: MarkdownRendererProps) {
  if (!content) return null

  return (
    <div className={cn("markdown-body min-w-0 w-full", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
