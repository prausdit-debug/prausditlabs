"use client"

/**
 * components/docs/doc-content.tsx
 *
 * FIXES:
 *  1. TipTap produces HTML, not Markdown. The previous version used
 *     <ReactMarkdown> which rendered HTML tags as literal text.
 *     This version renders HTML correctly via dangerouslySetInnerHTML.
 *
 *  2. Stored XSS: HTML content was unsanitized. This version sanitizes
 *     with DOMPurify (isomorphic-dompurify) before rendering.
 *     Install: npm install isomorphic-dompurify @types/dompurify
 *
 * If you store Markdown (not HTML) in some docs, detect the format:
 * HTML docs will start with "<" or contain "<p>", "<h1>", etc.
 * Markdown docs will not. You can branch on that check if needed.
 */

import DOMPurify from "isomorphic-dompurify"

// ─── Allowed tags / attributes ────────────────────────────────────────────────
// This matches everything TipTap's StarterKit + extensions can produce.

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "strong", "em", "u", "s", "code", "pre",
  "ul", "ol", "li",
  "blockquote",
  "a",
  "img",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "div", "span",
]

const ALLOWED_ATTR = [
  "href", "src", "alt", "title", "class",
  "target", "rel",
  "width", "height",
  "colspan", "rowspan",
  // data-* used by some TipTap extensions
  "data-type", "data-id",
]

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Force links to be safe
    FORCE_BODY: true,
    ADD_ATTR: ["target"],
    // Prevent javascript: URIs in href / src
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  })
}

// ─── Detect content format ────────────────────────────────────────────────────

function isHtml(content: string): boolean {
  const trimmed = content.trimStart()
  return trimmed.startsWith("<") || /<(p|h[1-6]|ul|ol|div|strong|em|br)\b/i.test(trimmed)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DocContentProps {
  content: string
}

export function DocContent({ content }: DocContentProps) {
  if (!content) return null

  // If the content is HTML (from TipTap), sanitize and render as HTML
  if (isHtml(content)) {
    const clean = sanitize(content)
    return (
      <div
        className="prose-dark"
        // DOMPurify sanitization makes this safe
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    )
  }

  // Fallback: treat as plain text (wraps in <pre> to preserve whitespace)
  return (
    <div className="prose-dark">
      <pre className="whitespace-pre-wrap font-sans text-sm">{content}</pre>
    </div>
  )
}
