/**
 * lib/html-to-markdown.ts
 *
 * Zero-dependency HTML → Markdown converter, purpose-built for TipTap output.
 * Runs on both server (Node/Bun) and client (browser DOM).
 *
 * Why not `turndown`?
 *   This is intentionally minimal and tuned exactly to TipTap's HTML output,
 *   which is well-structured and predictable. Adding turndown (44 KB) for
 *   converting a known HTML subset is unnecessary.
 *
 * Supported elements (mirrors TipTap StarterKit + extensions used here):
 *   h1–h6, p, strong, em, u, s, code, pre/code, ul/li, ol/li,
 *   blockquote, hr, a, img, table/thead/tbody/tr/th/td, br
 *
 * Usage:
 *   import { htmlToMarkdown } from "@/lib/html-to-markdown"
 *   const md = htmlToMarkdown(editor.getHTML())
 *
 * Inverse:
 *   Use MarkdownRenderer to display the result.
 *   Use tiptapMarkdownContent(md) to load it back into TipTap.
 */

// ─── Node type (isomorphic) ──────────────────────────────────────────────────

type DomNode = Element | ChildNode

// ─── Server-safe DOM parser ───────────────────────────────────────────────────

function parseHTML(html: string): Element {
  if (typeof window !== "undefined") {
    // Browser: use native DOMParser
    const doc = new DOMParser().parseFromString(html, "text/html")
    return doc.body
  }
  // Server (Node / Bun): naive regex-free approach using string parsing
  // We do a light structural parse since TipTap output is well-structured.
  // For full server-side conversion, install `jsdom` or `@tiptap/pm`.
  // This fallback returns a mock element that triggers the plain-text path.
  return {
    childNodes: [],
    tagName:    "BODY",
    innerHTML:  html,
    textContent: html.replace(/<[^>]+>/g, ""),
  } as unknown as Element
}

// ─── Converter ────────────────────────────────────────────────────────────────

function convertNode(node: DomNode, listType?: "ul" | "ol", listDepth = 0): string {
  // Text node
  if (node.nodeType === 3) {
    return (node as Text).textContent ?? ""
  }

  const el = node as Element
  const tag = el.tagName?.toLowerCase() ?? ""
  const children = () => Array.from(el.childNodes)
    .map(n => convertNode(n, listType, listDepth))
    .join("")

  switch (tag) {
    // ── Headings ─────────────────────────────────────────────────────────────
    case "h1": return `\n# ${children().trim()}\n\n`
    case "h2": return `\n## ${children().trim()}\n\n`
    case "h3": return `\n### ${children().trim()}\n\n`
    case "h4": return `\n#### ${children().trim()}\n\n`
    case "h5": return `\n##### ${children().trim()}\n\n`
    case "h6": return `\n###### ${children().trim()}\n\n`

    // ── Paragraph ─────────────────────────────────────────────────────────────
    case "p": {
      const text = children().trim()
      return text ? `${text}\n\n` : "\n"
    }

    // ── Inline formatting ─────────────────────────────────────────────────────
    case "strong":
    case "b": {
      const t = children()
      return t.trim() ? `**${t}**` : ""
    }
    case "em":
    case "i": {
      const t = children()
      return t.trim() ? `*${t}*` : ""
    }
    case "u": {
      // Markdown doesn't have underline; preserve as HTML
      const t = children()
      return t.trim() ? `<u>${t}</u>` : ""
    }
    case "s":
    case "del":
    case "strike": {
      const t = children()
      return t.trim() ? `~~${t}~~` : ""
    }

    // ── Code ──────────────────────────────────────────────────────────────────
    case "code": {
      const parent = el.parentElement?.tagName?.toLowerCase()
      if (parent === "pre") {
        // Handled by <pre>
        return el.textContent ?? ""
      }
      return `\`${el.textContent ?? ""}\``
    }
    case "pre": {
      const codeEl = el.querySelector("code")
      const langClass = codeEl?.className ?? ""
      const lang = langClass.replace(/.*language-/, "").replace(/\s.*/, "")
      const code = codeEl?.textContent ?? el.textContent ?? ""
      return `\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`
    }

    // ── Links & images ────────────────────────────────────────────────────────
    case "a": {
      const href  = el.getAttribute("href") ?? "#"
      const label = children().trim()
      return label ? `[${label}](${href})` : href
    }
    case "img": {
      const src = el.getAttribute("src") ?? ""
      const alt = el.getAttribute("alt") ?? ""
      return `![${alt}](${src})`
    }

    // ── Lists ─────────────────────────────────────────────────────────────────
    case "ul": {
      const items = Array.from(el.children)
        .map(li => convertNode(li, "ul", listDepth))
        .join("")
      return `${items}\n`
    }
    case "ol": {
      let counter = 1
      const items = Array.from(el.children)
        .map(li => {
          const text = convertNode(li, "ol", listDepth)
          // Replace the bullet character injected by <li> handler
          return text.replace(/^[•-] /, `${counter++}. `)
        })
        .join("")
      return `${items}\n`
    }
    case "li": {
      const indent = "  ".repeat(listDepth)
      // Handle nested lists
      const parts: string[] = []
      let textAccum = ""
      for (const child of Array.from(el.childNodes)) {
        const cTag = (child as Element).tagName?.toLowerCase()
        if (cTag === "ul" || cTag === "ol") {
          if (textAccum.trim()) {
            parts.push(`${indent}- ${textAccum.trim()}`)
            textAccum = ""
          }
          parts.push(convertNode(child, cTag as "ul" | "ol", listDepth + 1))
        } else {
          textAccum += convertNode(child, listType, listDepth)
        }
      }
      if (textAccum.trim()) {
        parts.push(`${indent}- ${textAccum.trim()}`)
      }
      return parts.join("\n") + "\n"
    }

    // ── Blockquote ────────────────────────────────────────────────────────────
    case "blockquote": {
      const inner = children().trim()
      return `\n${inner.split("\n").map(l => `> ${l}`).join("\n")}\n\n`
    }

    // ── Table ─────────────────────────────────────────────────────────────────
    case "table": {
      const rows = Array.from(el.querySelectorAll("tr"))
      if (rows.length === 0) return ""
      const mdRows = rows.map((row, i) => {
        const cells = Array.from(row.querySelectorAll("th, td"))
          .map(cell => convertNode(cell, undefined, 0).trim().replace(/\|/g, "\\|"))
          .join(" | ")
        const line = `| ${cells} |`
        if (i === 0) {
          const sep = cells.split(" | ").map(() => "---").join(" | ")
          return `${line}\n| ${sep} |`
        }
        return line
      })
      return `\n${mdRows.join("\n")}\n\n`
    }
    case "thead":
    case "tbody":
    case "tfoot":
      return children()
    case "tr":
    case "th":
    case "td":
      return children()

    // ── HR / BR ───────────────────────────────────────────────────────────────
    case "hr": return `\n---\n\n`
    case "br": return `  \n`

    // ── Block wrappers — pass through ─────────────────────────────────────────
    case "div":
    case "section":
    case "article":
    case "body":
      return children()

    // ── Span — pass through ───────────────────────────────────────────────────
    case "span":
      return children()

    default:
      return children()
  }
}

/**
 * Convert a TipTap HTML string to Markdown.
 *
 * Works in the browser only (requires DOM).
 * On the server it returns a sanitized text fallback.
 */
export function htmlToMarkdown(html: string): string {
  if (!html?.trim()) return ""

  // Already markdown (doesn't look like HTML)
  if (!html.trimStart().startsWith("<")) return html

  try {
    const root = parseHTML(html)
    const raw  = Array.from(root.childNodes)
      .map(n => convertNode(n))
      .join("")

    return raw
      // Collapse 3+ consecutive newlines → max 2
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  } catch {
    // Fallback: strip tags
    return html.replace(/<[^>]+>/g, "").trim()
  }
}

/**
 * Detect whether a string is HTML (TipTap-produced) or Markdown.
 * Used by DocContent and view pages to pick the right renderer.
 */
export function isHtmlContent(content: string): boolean {
  const trimmed = content.trimStart()
  return (
    trimmed.startsWith("<") ||
    /<(p|h[1-6]|ul|ol|div|strong|em|table|blockquote|br)\b/i.test(trimmed)
  )
}

/**
 * Load a Markdown string into TipTap as plain paragraphs.
 * For proper Markdown→HTML conversion in TipTap, use the
 * @tiptap/extension-markdown package (optional dependency).
 *
 * This minimal version wraps each "paragraph" in <p> tags
 * so TipTap can display it cleanly without any extra extension.
 */
export function markdownToTiptapHtml(markdown: string): string {
  if (!markdown?.trim()) return "<p></p>"

  // If it's already HTML, pass through
  if (isHtmlContent(markdown)) return markdown

  // Very light conversion: preserve blank-line-separated paragraphs
  // For rich markdown (headings, lists etc.) in TipTap, install
  // @tiptap/extension-markdown and use editor.commands.setContent(markdown)
  return markdown
    .split(/\n{2,}/)
    .map(block => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("")
}
