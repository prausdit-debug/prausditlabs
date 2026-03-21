"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Edit3, Save, X, Loader2, StickyNote, Trash2, Sparkles, Tag, Pin } from "lucide-react"
import Link from "next/link"
import { ResourceMetadata } from "@/components/shared/resource-metadata"
import { AIEditDialog } from "@/components/editor/ai-edit-dialog"
import { useCurrentUser } from "@/components/auth/auth-guard"
import { cn } from "@/lib/utils"
import { MarkdownRenderer } from "@/components/chat/markdown-renderer"

interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  pinned: boolean
  createdAt: string
  updatedAt: string
  createdByUserId?: string | null
  createdByUserName?: string | null
  createdWithAIModel?: string | null
  lastEditedByUserId?: string | null
  lastEditedByUserName?: string | null
  lastEditedAt?: string | null
  editedWithAIModel?: string | null
}

export default function NoteDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: "", content: "" })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [usedAIModel, setUsedAIModel] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/notes/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setNote(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const startEdit = () => {
    if (!note) return
    setEditForm({
      title: note.title,
      content: note.content || "",
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!note) return
    setSaving(true)
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        lastEditedByUserId: currentUser?.id || null,
        lastEditedByUserName: currentUser?.name || currentUser?.email || null,
        ...(usedAIModel && { editedWithAIModel: usedAIModel }),
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setNote(updated)
      setEditing(false)
      setUsedAIModel(null)
    }
    setSaving(false)
  }

  const togglePin = async () => {
    if (!note) return
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !note.pinned }),
    })
    if (res.ok) {
      const updated = await res.json()
      setNote(updated)
    }
  }

  const handleAIEdit = useCallback(() => {
    const selection = window.getSelection()?.toString() || ""
    if (selection.trim()) {
      setSelectedText(selection)
      setAiDialogOpen(true)
    }
  }, [])

  const handleAIAccept = useCallback((newText: string, modelName: string) => {
    if (selectedText && editForm.content.includes(selectedText)) {
      setEditForm(f => ({ ...f, content: f.content.replace(selectedText, newText) }))
      setUsedAIModel(modelName)
    }
    setAiDialogOpen(false)
    setSelectedText("")
  }, [selectedText, editForm.content])

  const handleDelete = async () => {
    if (!confirm("Delete this note permanently?")) return
    setDeleting(true)
    await fetch(`/api/notes/${id}`, { method: "DELETE" })
    router.push("/notes")
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="h-8 bg-muted rounded w-1/2 animate-pulse" />
        <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
        <div className="space-y-2 mt-8">
          {[1,2,3].map(i => <div key={i} className="h-4 bg-muted rounded animate-pulse" style={{ width: `${90 - i * 10}%` }} />)}
        </div>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="text-center py-20">
        <p className="text-[14px] text-muted-foreground mb-4">Note not found.</p>
        <Link href="/notes" className="text-amber-400 hover:text-amber-300 text-[13px]">Back to Notes</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/notes" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-mono">
            <span className="text-amber-500">&#9656;</span> NOTES
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <>
              <button
                onClick={togglePin}
                className={cn(
                  "p-1.5 rounded-lg border transition-colors",
                  note.pinned 
                    ? "border-amber-500/50 text-amber-400 bg-amber-500/10" 
                    : "border-border text-muted-foreground hover:text-foreground hover:border-amber-500/30"
                )}
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-amber-500/30 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {editing && (
            <>
              <button
                onClick={handleAIEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/50 text-purple-400 text-[12px] hover:bg-purple-500/10 transition-colors"
                title="Select text first, then click to edit with AI"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Edit with AI
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-black text-[12px] font-semibold hover:bg-amber-400 transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
          <StickyNote className="w-6 h-6 text-yellow-400" />
        </div>
        <div className="flex-1">
          {editing ? (
            <input
              value={editForm.title}
              onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
              className="w-full text-2xl font-bold bg-transparent border-b border-amber-500/40 text-foreground outline-none pb-2"
            />
          ) : (
            <h1 className="text-2xl font-bold text-foreground">{note.title}</h1>
          )}
          {note.pinned && (
            <span className="inline-flex items-center gap-1 mt-2 text-[11px] px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-400 bg-amber-500/10">
              <Pin className="w-2.5 h-2.5" />
              Pinned
            </span>
          )}
        </div>
      </div>

      {/* Metadata */}
      <ResourceMetadata
        createdByUserName={note.createdByUserName}
        createdAt={note.createdAt}
        createdWithAIModel={note.createdWithAIModel}
        lastEditedByUserName={note.lastEditedByUserName}
        lastEditedAt={note.lastEditedAt}
        editedWithAIModel={note.editedWithAIModel}
      />

      {/* Content */}
      <div className="rounded-xl border border-border bg-card overflow-hidden min-h-[200px]">
        {editing ? (
          /* Markdown textarea — auto-grows, monospace for clarity */
          <div className="relative">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
              <span className="text-[10px] font-mono text-amber-400/70 select-none">.md</span>
              <span className="text-[10px] text-muted-foreground/50">
                Markdown supported — **bold**, ## heading, - list, `code`
              </span>
            </div>
            <textarea
              value={editForm.content}
              onChange={e => setEditForm(p => ({ ...p, content: e.target.value }))}
              rows={14}
              className="w-full px-4 py-3 bg-transparent text-foreground text-[13px] font-mono outline-none focus:ring-0 resize-y border-0 caret-amber-400 placeholder:text-muted-foreground/40 leading-relaxed"
              placeholder="Write your note in Markdown... (**bold**, ## heading, - list, ```code```)"
              spellCheck={false}
            />
          </div>
        ) : (
          /* MarkdownRenderer replaces the old whitespace-pre-wrap div.
             Notes created by the AI agent output Markdown — this renders them correctly. */
          <div className="p-5">
            {note.content
              ? <MarkdownRenderer content={note.content} />
              : <p className="text-[13px] text-muted-foreground/50 italic">No content.</p>
            }
          </div>
        )}
      </div>

      {/* Tags */}
      {note.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {note.tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-muted text-muted-foreground">
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* AI Edit Dialog */}
      <AIEditDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        selectedText={selectedText}
        onAccept={handleAIAccept}
      />
    </div>
  )
}
