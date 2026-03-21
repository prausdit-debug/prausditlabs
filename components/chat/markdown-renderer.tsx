"use client"

/**
 * components/chat/markdown-renderer.tsx
 *
 * Production-grade Markdown renderer for chat messages.
 * Uses react-markdown + remark-gfm (both already in package.json).
 * All styling is inline via Tailwind — no @tailwindcss/typography needed.
 *
 * Supports:
 *  ✅ Headings (h1–h6)          ✅ Bold / Italic / Strikethrough
 *  ✅ Ordered & unordered lists  ✅ Nested lists
 *  ✅ Inline code                ✅ Code blocks (with language label)
 *  ✅ Blockquotes                ✅ Tables (GFM)
 *  ✅ Horizontal rules           ✅ Links (open in new tab)
 *  ✅ Task lists (GFM)
 */

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import type { Components } from "react-markdown"

// ─── Shared prose colour tokens ───────────────────────────────────────────────
const TEXT_BASE    = "text-foreground"
const TEXT_MUTED   = "text-muted-foreground"
const TEXT_AMBER   = "text-amber-400"
const BORDER       = "border-border"
const BG_MUTED     = "bg-muted/40"
const BG_CODE      = "bg-zinc-900 dark:bg-zinc-950"

// ─── Component map ────────────────────────────────────────────────────────────

const components: Components = {
  // ── Headings ───────────────────────────────────────────────────────────────
  h1: ({ children }) => (
    <h1 className={cn("mt-5 mb-3 text-[22px] font-bold leading-tight tracking-tight", TEXT_BASE)}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className={cn("mt-5 mb-2.5 text-[18px] font-semibold leading-snug", TEXT_BASE)}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className={cn("mt-4 mb-2 text-[15px] font-semibold", TEXT_BASE)}>
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className={cn("mt-3 mb-1.5 text-[14px] font-semibold", TEXT_BASE)}>
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5 className={cn("mt-3 mb-1 text-[13px] font-semibold", TEXT_MUTED)}>
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6 className={cn("mt-2 mb-1 text-[12px] font-semibold uppercase tracking-wide", TEXT_MUTED)}>
      {children}
    </h6>
  ),

  // ── Paragraph ──────────────────────────────────────────────────────────────
  p: ({ children }) => (
    <p className={cn("mb-3 last:mb-0 leading-[1.75] text-[14px]", TEXT_BASE)}>
      {children}
    </p>
  ),

  // ── Lists ──────────────────────────────────────────────────────────────────
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
  li: ({ children, ...props }) => {
    // Task list item detection
    const childArray = Array.isArray(children) ? children : [children]
    const firstChild = childArray[0]
    const isTaskItem = firstChild && typeof firstChild === "object" &&
      "props" in (firstChild as object) &&
      (firstChild as React.ReactElement).type === "input"

    if (isTaskItem) {
      return (
        <li className={cn("flex items-start gap-2 text-[14px] leading-[1.7]", TEXT_BASE)} {...props}>
          {children}
        </li>
      )
    }

    return (
      <li className={cn("flex items-start gap-2 text-[14px] leading-[1.7]", TEXT_BASE)}>
        <span className={cn("mt-[0.45em] w-1.5 h-1.5 rounded-full flex-shrink-0", TEXT_AMBER)} 
              style={{ background: "currentColor", minWidth: "6px" }} />
        <span className="flex-1 min-w-0">{children}</span>
      </li>
    )
  },

  // ── Checkbox (task list) ───────────────────────────────────────────────────
  input: ({ checked, ...props }) => (
    <input
      type="checkbox"
      checked={checked}
      readOnly
      className="mt-1 w-3.5 h-3.5 rounded border border-border accent-amber-500 flex-shrink-0 cursor-default"
      {...props}
    />
  ),

  // ── Inline code ────────────────────────────────────────────────────────────
  // Note: CodeBlock below handles the fenced ```lang``` case
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-")
    if (isBlock) {
      // Handled by `pre` below
      return <code className={className}>{children}</code>
    }
    return (
      <code className="px-1.5 py-0.5 rounded-md text-[12.5px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
        {children}
      </code>
    )
  },

  // ── Code block ─────────────────────────────────────────────────────────────
  pre: ({ children, ...props }) => {
    // Extract language from className="language-xxx"
    const codeEl = children as React.ReactElement | null
    const lang = codeEl?.props?.className?.replace("language-", "") ?? ""
    const codeText = codeEl?.props?.children ?? ""

    return (
      <div className="mb-4 rounded-xl overflow-hidden border border-border/60 shadow-sm">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/80 border-b border-zinc-700/50">
          <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
            {lang || "code"}
          </span>
          <CopyButton text={String(codeText)} />
        </div>
        {/* Code */}
        <pre
          className={cn(
            "overflow-x-auto px-4 py-3 text-[12.5px] font-mono leading-[1.7]",
            BG_CODE,
            "text-zinc-200"
          )}
          {...props}
        >
          {children}
        </pre>
      </div>
    )
  },

  // ── Blockquote ─────────────────────────────────────────────────────────────
  blockquote: ({ children }) => (
    <blockquote className={cn(
      "my-3 pl-4 border-l-[3px] border-amber-500/50",
      "text-[14px] italic",
      TEXT_MUTED,
      BG_MUTED,
      "pr-3 py-2 rounded-r-lg"
    )}>
      {children}
    </blockquote>
  ),

  // ── Horizontal rule ────────────────────────────────────────────────────────
  hr: () => (
    <hr className={cn("my-5 border-t", BORDER, "opacity-50")} />
  ),

  // ── Strong / Em / Del ──────────────────────────────────────────────────────
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground/90">{children}</em>
  ),
  del: ({ children }) => (
    <del className="line-through text-muted-foreground/70">{children}</del>
  ),

  // ── Link ───────────────────────────────────────────────────────────────────
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

  // ── Table ──────────────────────────────────────────────────────────────────
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

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={copy}
      className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-0.5 rounded border border-zinc-700/50 hover:border-zinc-600"
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  )
}

// Need React import for CopyButton state
import React from "react"

// ─── Main component ───────────────────────────────────────────────────────────

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
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
}
