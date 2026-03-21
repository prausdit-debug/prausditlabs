"use client"

/**
 * components/editor/rich-text-editor.tsx
 *
 * Production-grade dual-mode editor for Prausdit Research Lab.
 *
 * ─── Modes ───────────────────────────────────────────────────────────────────
 * RICH mode  → TipTap WYSIWYG editor. onChange emits sanitized HTML.
 *              Used for documents where formatting richness matters.
 *
 * MARKDOWN mode → Plain textarea. onChange emits raw Markdown string.
 *                 Used when content was AI-generated or user prefers MD.
 *
 * The mode toggle (toolbar top-right) switches between both.
 * When switching RICH → MARKDOWN, HTML is converted to Markdown client-side
 * using the zero-dependency htmlToMarkdown() utility.
 * When switching MARKDOWN → RICH, markdown is loaded into TipTap as-is
 * (TipTap renders it as plain text by default; install
 * @tiptap/extension-markdown for full round-trip fidelity).
 *
 * ─── Format detection on load ─────────────────────────────────────────────
 * If the initial `content` prop is Markdown (not HTML), the editor boots
 * in MARKDOWN mode automatically so the user sees markdown syntax, not
 * the raw string displayed as if it were rich text.
 *
 * ─── onChange contract ────────────────────────────────────────────────────
 * In RICH mode:    emits editor.getHTML()     — string starting with "<p>"
 * In MARKDOWN mode: emits raw markdown string — string starting with text
 *
 * Callers (docs/[slug]/page.tsx, docs/create/page.tsx) should store
 * whatever string comes out and let DocContent auto-detect format on render.
 */

import { useEditor, EditorContent } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import StarterKit from "@tiptap/starter-kit"
import Heading from "@tiptap/extension-heading"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import { TextStyle } from "@tiptap/extension-text-style"
import Typography from "@tiptap/extension-typography"
import { useState, useCallback, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { htmlToMarkdown, isHtmlContent, markdownToTiptapHtml } from "@/lib/html-to-markdown"
import {
  Bold, Italic, UnderlineIcon, Strikethrough, Code, Link2,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  Minus, Undo, Redo, Image as ImageIcon, AlignLeft,
  FileText, Hash,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type EditorMode = "rich" | "markdown"

interface RichTextEditorProps {
  content: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  /** Force a specific mode regardless of content detection */
  defaultMode?: EditorMode
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick, active, title, children, disabled,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "p-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed",
        active && "bg-amber-500/10 text-amber-400"
      )}
    >
      {children}
    </button>
  )
}

// ─── Mode toggle ──────────────────────────────────────────────────────────────

function ModeToggle({
  mode,
  onToggle,
}: {
  mode: EditorMode
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={mode === "rich" ? "Switch to Markdown mode" : "Switch to Rich Text mode"}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border",
        mode === "markdown"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {mode === "rich" ? (
        <>
          <Hash className="w-3 h-3" />
          <span className="hidden sm:inline">Markdown</span>
        </>
      ) : (
        <>
          <FileText className="w-3 h-3" />
          <span className="hidden sm:inline">Rich Text</span>
        </>
      )}
    </button>
  )
}

// ─── Format badge ─────────────────────────────────────────────────────────────

function FormatBadge({ mode }: { mode: EditorMode }) {
  return (
    <span className={cn(
      "text-[10px] font-mono px-1.5 py-0.5 rounded border select-none",
      mode === "markdown"
        ? "text-amber-400/70 border-amber-500/20 bg-amber-500/5"
        : "text-muted-foreground/50 border-border/50"
    )}>
      {mode === "markdown" ? ".md" : "html"}
    </span>
  )
}

// ─── Markdown textarea ────────────────────────────────────────────────────────

function MarkdownTextarea({
  value,
  onChange,
  placeholder,
  minHeight,
}: {
  value:       string
  onChange:    (v: string) => void
  placeholder: string
  minHeight:   string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-grow
  const grow = useCallback(() => {
    const ta = ref.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.max(ta.scrollHeight, parseInt(minHeight))}px`
  }, [minHeight])

  useEffect(() => { grow() }, [value, grow])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => { onChange(e.target.value); grow() }}
      placeholder={placeholder}
      className={cn(
        "w-full bg-transparent text-foreground text-[14px] font-mono leading-relaxed",
        "outline-none resize-none placeholder:text-muted-foreground/50",
        "p-4 border-0 focus:ring-0 caret-amber-400"
      )}
      style={{ minHeight, maxHeight: "1200px" }}
      spellCheck={false}
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start writing…",
  minHeight   = "300px",
  defaultMode,
}: RichTextEditorProps) {

  // Boot in the right mode based on content format
  const initialMode: EditorMode =
    defaultMode ??
    (isHtmlContent(content) ? "rich" : "markdown")

  const [mode, setMode]         = useState<EditorMode>(initialMode)
  const [mdValue, setMdValue]   = useState(() =>
    mode === "markdown" ? content : ""
  )

  // ── TipTap editor ──────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: {
          HTMLAttributes: {
            class: "bg-zinc-900 text-emerald-300 rounded-lg p-4 font-mono text-sm my-3 overflow-x-auto",
          },
        },
        bulletList: {
          HTMLAttributes: { class: "list-disc pl-5 space-y-1" },
        },
        orderedList: {
          HTMLAttributes: { class: "list-decimal pl-5 space-y-1" },
        },
        blockquote: {
          HTMLAttributes: {
            class: "border-l-4 border-amber-500/50 pl-4 text-muted-foreground italic my-3",
          },
        },
      }),
      Heading.configure({
        levels: [1, 2, 3],
        HTMLAttributes: { class: "font-bold text-foreground" },
      }),
      Placeholder.configure({ placeholder }),
      Underline,
      TextStyle,
      Typography,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-amber-400 underline cursor-pointer hover:text-amber-300",
        },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full my-3" },
      }),
    ],
    content: isHtmlContent(content) ? content : markdownToTiptapHtml(content),
    onUpdate: ({ editor }) => {
      if (mode === "rich") {
        onChange(editor.getHTML())
      }
    },
    editorProps: {
      attributes: {
        class: "outline-none prose-dark text-[14px] leading-relaxed",
        style: `min-height: ${minHeight}`,
      },
    },
  })

  // ── Mode switch ────────────────────────────────────────────────────────────
  const handleModeToggle = useCallback(() => {
    if (!editor) return

    if (mode === "rich") {
      // Convert TipTap HTML → Markdown
      const html = editor.getHTML()
      const md   = htmlToMarkdown(html)
      setMdValue(md)
      setMode("markdown")
      onChange(md)
    } else {
      // Load markdown into TipTap (plain paragraph fallback)
      const html = markdownToTiptapHtml(mdValue)
      editor.commands.setContent(html)
      setMode("rich")
      onChange(html)
    }
  }, [mode, editor, mdValue, onChange])

  // ── Markdown textarea change ───────────────────────────────────────────────
  const handleMdChange = useCallback((val: string) => {
    setMdValue(val)
    onChange(val)
  }, [onChange])

  if (!editor) return null

  const isMarkdown = mode === "markdown"

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-2 border-b border-border bg-muted/30">
        {/* Rich-text controls — hidden in markdown mode */}
        {!isMarkdown && (
          <>
            {/* History */}
            <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
              <Undo className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
              <Redo className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <div className="w-px h-4 bg-border mx-1" />

            {/* Headings */}
            <ToolbarBtn
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              active={editor.isActive("heading", { level: 1 })}
              title="Heading 1"
            >
              <Heading1 className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive("heading", { level: 2 })}
              title="Heading 2"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor.isActive("heading", { level: 3 })}
              title="Heading 3"
            >
              <Heading3 className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <div className="w-px h-4 bg-border mx-1" />

            {/* Inline formatting */}
            <ToolbarBtn
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive("bold")}
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive("italic")}
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              active={editor.isActive("underline")}
              title="Underline"
            >
              <UnderlineIcon className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().toggleStrike().run()}
              active={editor.isActive("strike")}
              title="Strikethrough"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().toggleCode().run()}
              active={editor.isActive("code")}
              title="Inline code"
            >
              <Code className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <div className="w-px h-4 bg-border mx-1" />

            {/* Lists */}
            <ToolbarBtn
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive("bulletList")}
              title="Bullet list"
            >
              <List className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive("orderedList")}
              title="Ordered list"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive("blockquote")}
              title="Blockquote"
            >
              <Quote className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              active={editor.isActive("codeBlock")}
              title="Code block"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <div className="w-px h-4 bg-border mx-1" />

            {/* Extras */}
            <ToolbarBtn
              onClick={() => {
                const url = window.prompt("Enter URL")
                if (url) editor.chain().focus().setLink({ href: url }).run()
              }}
              active={editor.isActive("link")}
              title="Add link"
            >
              <Link2 className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => {
                const url = window.prompt("Enter image URL")
                if (url) editor.chain().focus().setImage({ src: url }).run()
              }}
              title="Insert image"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Horizontal rule"
            >
              <Minus className="w-3.5 h-3.5" />
            </ToolbarBtn>
          </>
        )}

        {/* Markdown mode hint */}
        {isMarkdown && (
          <span className="text-[11px] text-muted-foreground/60 px-1 select-none">
            Editing Markdown — use <code className="text-amber-400 text-[10px]">**bold**</code>, <code className="text-amber-400 text-[10px]">## heading</code>, etc.
          </span>
        )}

        {/* Spacer + format badge + mode toggle */}
        <div className="flex-1" />
        <FormatBadge mode={mode} />
        <div className="ml-1">
          <ModeToggle mode={mode} onToggle={handleModeToggle} />
        </div>
      </div>

      {/* ── Editor body ───────────────────────────────────────────────────── */}
      {isMarkdown ? (
        <MarkdownTextarea
          value={mdValue}
          onChange={handleMdChange}
          placeholder={placeholder}
          minHeight={minHeight}
        />
      ) : (
        <>
          {/* Bubble menu */}
          <BubbleMenu editor={editor} options={{ placement: "top" }}>
            <div className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg border border-border bg-card shadow-lg">
              <ToolbarBtn
                onClick={() => editor.chain().focus().toggleBold().run()}
                active={editor.isActive("bold")}
                title="Bold"
              >
                <Bold className="w-3 h-3" />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor.chain().focus().toggleItalic().run()}
                active={editor.isActive("italic")}
                title="Italic"
              >
                <Italic className="w-3 h-3" />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                active={editor.isActive("underline")}
                title="Underline"
              >
                <UnderlineIcon className="w-3 h-3" />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => editor.chain().focus().toggleCode().run()}
                active={editor.isActive("code")}
                title="Code"
              >
                <Code className="w-3 h-3" />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => {
                  const url = window.prompt("Enter URL")
                  if (url) editor.chain().focus().setLink({ href: url }).run()
                }}
                active={editor.isActive("link")}
                title="Link"
              >
                <Link2 className="w-3 h-3" />
              </ToolbarBtn>
            </div>
          </BubbleMenu>

          {/* Rich text editing surface */}
          <div className="p-4">
            <EditorContent editor={editor} />
          </div>
        </>
      )}
    </div>
  )
}
