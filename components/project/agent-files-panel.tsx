"use client"

/**
 * AgentFilesPanel
 *
 * Full CRM UI for the multi-file agent configuration system.
 * Place this component inside your settings page or agent settings tab.
 *
 * Usage in app/(dashboard)/settings/page.tsx:
 *   import { AgentFilesPanel } from "@/components/project/agent-files-panel"
 *   ...
 *   <AgentFilesPanel />
 *
 * Features:
 *   - File list sidebar (type-grouped, active badge)
 *   - Monaco-style textarea editor
 *   - Upload .md file button
 *   - Toggle active/inactive per file
 *   - Version history viewer + rollback
 *   - Create new file dialog
 *   - Safety: prevents deactivating last system file
 */

import { useState, useEffect, useRef, useCallback } from "react"
import {
  FileText, Plus, Upload, ToggleLeft, ToggleRight, History,
  ChevronRight, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Trash2, RotateCcw, Save, Eye, EyeOff, Settings2, X,
  Shield, Wrench, BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentFile {
  id:        string
  name:      string
  type:      "system" | "rules" | "tools"
  content:   string
  isActive:  boolean
  order:     number
  createdAt: string
  updatedAt: string
  history:   Array<{ id: string; version: number; savedBy: string | null; createdAt: string }>
}

interface HistoryRecord {
  id:        string
  version:   number
  content:   string
  savedBy:   string | null
  createdAt: string
}

type Tab = "editor" | "history"

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META = {
  system: { label: "System",  icon: Shield,   color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20",  desc: "Replaces/extends the base system prompt" },
  rules:  { label: "Rules",   icon: BookOpen, color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20",   desc: "Additional behavioral rules injected below system" },
  tools:  { label: "Tools",   icon: Wrench,   color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",    desc: "Tool configuration and overrides" },
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: string; message: string; type: "success" | "error" | "warning" }

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = Date.now().toString()
    setToasts((p) => [...p, { id, message, type }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000)
  }, [])
  return { toasts, show }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AgentFilesPanel() {
  const [files, setFiles]               = useState<AgentFile[]>([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState<AgentFile | null>(null)
  const [editContent, setEditContent]   = useState("")
  const [editName, setEditName]         = useState("")
  const [saving, setSaving]             = useState(false)
  const [dirty, setDirty]               = useState(false)
  const [activeTab, setActiveTab]       = useState<Tab>("editor")
  const [history, setHistory]           = useState<HistoryRecord[]>([])
  const [historyLoading, setHistLoading]= useState(false)
  const [showCreate, setShowCreate]     = useState(false)
  const [toggling, setToggling]         = useState<string | null>(null)
  const [deleting, setDeleting]         = useState<string | null>(null)
  const [previewVer, setPreviewVer]     = useState<HistoryRecord | null>(null)
  const fileInputRef                    = useRef<HTMLInputElement>(null)
  const { toasts, show }                = useToast()

  // ── Fetch files ─────────────────────────────────────────────────────────────

  const fetchFiles = useCallback(async () => {
    try {
      const res  = await fetch("/api/agent/files")
      const data = await res.json()
      setFiles(data.files || [])
    } catch {
      show("Failed to load agent files", "error")
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  // ── Select file ─────────────────────────────────────────────────────────────

  const selectFile = (file: AgentFile) => {
    if (dirty && !confirm("You have unsaved changes. Discard them?")) return
    setSelected(file)
    setEditContent(file.content)
    setEditName(file.name)
    setDirty(false)
    setActiveTab("editor")
    setHistory([])
    setPreviewVer(null)
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch("/api/agent/files", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: selected.id, name: editName, type: selected.type, content: editContent }),
      })
      const data = await res.json()
      if (!res.ok) { show(data.error || "Save failed", "error"); return }
      show("File saved ✓", "success")
      setDirty(false)
      await fetchFiles()
      setSelected((p) => p ? { ...p, content: editContent, name: editName } : p)
    } catch { show("Save failed", "error") }
    finally { setSaving(false) }
  }

  // ── Toggle ───────────────────────────────────────────────────────────────────

  const toggle = async (file: AgentFile) => {
    setToggling(file.id)
    try {
      const res  = await fetch("/api/agent/files/toggle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: file.id }) })
      const data = await res.json()
      if (!res.ok) { show(data.error || "Toggle failed", "error"); return }
      show(data.message, "success")
      await fetchFiles()
    } catch { show("Toggle failed", "error") }
    finally { setToggling(null) }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  const deleteFile = async (file: AgentFile) => {
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return
    setDeleting(file.id)
    try {
      const res  = await fetch(`/api/agent/files?id=${file.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) { show(data.error || "Delete failed", "error"); return }
      show("File deleted", "success")
      if (selected?.id === file.id) setSelected(null)
      await fetchFiles()
    } catch { show("Delete failed", "error") }
    finally { setDeleting(null) }
  }

  // ── Load history ─────────────────────────────────────────────────────────────

  const loadHistory = async () => {
    if (!selected) return
    setHistLoading(true)
    try {
      const res  = await fetch(`/api/agent/files/history?fileId=${selected.id}`)
      const data = await res.json()
      setHistory(data.history || [])
    } catch { show("Failed to load history", "error") }
    finally { setHistLoading(false) }
  }

  useEffect(() => {
    if (activeTab === "history" && selected) loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selected?.id])

  // ── Rollback ─────────────────────────────────────────────────────────────────

  const rollback = async (histId: string, version: number) => {
    if (!selected) return
    if (!confirm(`Roll back to v${version}? Current content will be backed up.`)) return
    try {
      const res  = await fetch("/api/agent/files/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rollback", fileId: selected.id, historyId: histId }) })
      const data = await res.json()
      if (!res.ok) { show(data.error || "Rollback failed", "error"); return }
      show(data.message, "success")
      await fetchFiles()
      setEditContent(data.file.content || "")
      setDirty(false)
      setActiveTab("editor")
    } catch { show("Rollback failed", "error") }
  }

  // ── File upload ───────────────────────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append("file", file)
    form.append("type", "rules")
    try {
      const res  = await fetch("/api/agent/files/upload", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) { show(data.error || "Upload failed", "error"); return }
      show(data.message, "success")
      await fetchFiles()
    } catch { show("Upload failed", "error") }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ── Group files by type ───────────────────────────────────────────────────────

  const grouped = {
    system: files.filter((f) => f.type === "system"),
    rules:  files.filter((f) => f.type === "rules"),
    tools:  files.filter((f) => f.type === "tools"),
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-[600px] rounded-xl border border-border bg-card overflow-hidden">

      {/* ── Toast stack ────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg border pointer-events-auto",
            t.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
            t.type === "error"   ? "bg-red-500/10 border-red-500/20 text-red-400" :
                                   "bg-amber-500/10 border-amber-500/20 text-amber-400")}>
            {t.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : t.type === "error" ? <XCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {t.message}
          </div>
        ))}
      </div>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 border-r border-border flex flex-col bg-muted/20">

        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Agent Files</span>
            </div>
            <span className="text-[11px] text-muted-foreground">{files.filter((f) => f.isActive).length}/{files.length} active</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(true)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[12px] font-medium transition-colors border border-primary/20">
              <Plus className="w-3.5 h-3.5" /> New
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground text-[12px] font-medium transition-colors border border-border">
              <Upload className="w-3.5 h-3.5" /> Upload
            </button>
            <input ref={fileInputRef} type="file" accept=".md" className="hidden" onChange={handleUpload} />
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : files.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-muted-foreground">No files yet.<br />Create one or upload a .md file.</div>
          ) : (
            (["system", "rules", "tools"] as const).map((type) => {
              const group = grouped[type]
              if (group.length === 0) return null
              const meta = TYPE_META[type]
              const Icon = meta.icon
              return (
                <div key={type}>
                  <div className="flex items-center gap-1.5 px-1 mb-1">
                    <Icon className={cn("w-3 h-3", meta.color)} />
                    <span className={cn("text-[11px] font-semibold uppercase tracking-wider", meta.color)}>{meta.label}</span>
                  </div>
                  <div className="space-y-1">
                    {group.map((file) => (
                      <div key={file.id} onClick={() => selectFile(file)}
                        className={cn("group relative flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all border",
                          selected?.id === file.id ? "bg-primary/10 border-primary/30" : "hover:bg-muted/50 border-transparent hover:border-border",
                          !file.isActive && "opacity-50")}>
                        <FileText className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0", file.isActive ? meta.color : "text-muted-foreground")} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-foreground truncate">{file.name}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {file.isActive ? (
                              <span className="text-[10px] text-emerald-400 font-medium">● active</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">○ inactive</span>
                            )}
                          </div>
                        </div>
                        {/* Quick actions */}
                        <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); toggle(file) }} className="p-0.5 hover:text-foreground text-muted-foreground transition-colors" title={file.isActive ? "Deactivate" : "Activate"}>
                            {toggling === file.id ? <Loader2 className="w-3 h-3 animate-spin" /> : file.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteFile(file) }} className="p-0.5 hover:text-red-400 text-muted-foreground transition-colors" title="Delete">
                            {deleting === file.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Main panel ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <FileText className="w-12 h-12 opacity-20" />
            <div className="text-center">
              <p className="text-sm font-medium">Select a file to edit</p>
              <p className="text-[12px] mt-1 opacity-70">or create/upload a new one</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 max-w-md w-full px-4">
              {(["system", "rules", "tools"] as const).map((type) => {
                const meta = TYPE_META[type]
                const Icon = meta.icon
                return (
                  <div key={type} className={cn("p-3 rounded-lg border text-center", meta.bg)}>
                    <Icon className={cn("w-5 h-5 mx-auto mb-1.5", meta.color)} />
                    <p className={cn("text-[11px] font-semibold", meta.color)}>{meta.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{meta.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <>
            {/* File header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold", TYPE_META[selected.type].bg, TYPE_META[selected.type].color)}>
                  {(() => { const Icon = TYPE_META[selected.type].icon; return <Icon className="w-3 h-3" /> })()}
                  {TYPE_META[selected.type].label}
                </div>
                <input
                  value={editName}
                  onChange={(e) => { setEditName(e.target.value); setDirty(true) }}
                  className="text-sm font-semibold bg-transparent border-none outline-none text-foreground min-w-0 flex-1"
                  placeholder="File name..."
                />
                {dirty && <span className="text-[11px] text-amber-400 flex-shrink-0">● unsaved</span>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Toggle active */}
                <button onClick={() => toggle(selected)} disabled={!!toggling} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors",
                  selected.isActive ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20" : "bg-muted border-border text-muted-foreground hover:bg-muted/80")}>
                  {toggling === selected.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : selected.isActive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                  {selected.isActive ? "Active" : "Inactive"}
                </button>
                {/* Save */}
                <button onClick={save} disabled={!dirty || saving} className={cn("flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium transition-colors",
                  dirty ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-not-allowed")}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-4">
              {(["editor", "history"] as Tab[]).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={cn("px-3 py-2 text-[12px] font-medium border-b-2 transition-colors capitalize",
                    activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {tab === "history" ? <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" />History ({selected.history[0]?.version ?? 0} versions)</span> : tab}
                </button>
              ))}
            </div>

            {/* Editor */}
            {activeTab === "editor" && (
              <div className="flex-1 flex flex-col min-h-0">
                <textarea
                  value={editContent}
                  onChange={(e) => { setEditContent(e.target.value); setDirty(true) }}
                  className="flex-1 w-full resize-none bg-transparent p-4 font-mono text-[13px] text-foreground leading-relaxed outline-none border-none"
                  placeholder="# My Agent File&#10;&#10;Write your markdown content here..."
                  spellCheck={false}
                />
                <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/10">
                  <span className="text-[11px] text-muted-foreground">{editContent.length.toLocaleString()} chars · {editContent.split("\n").length} lines</span>
                  <span className="text-[11px] text-muted-foreground">Markdown · Updated {new Date(selected.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            )}

            {/* History */}
            {activeTab === "history" && (
              <div className="flex-1 overflow-hidden flex min-h-0">
                {/* History list */}
                <div className="w-60 border-r border-border overflow-y-auto flex-shrink-0">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                  ) : history.length === 0 ? (
                    <div className="py-8 text-center text-[12px] text-muted-foreground">No history yet.<br />History saves on each update.</div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {history.map((h) => (
                        <div key={h.id} onClick={() => setPreviewVer(previewVer?.id === h.id ? null : h)}
                          className={cn("p-2.5 rounded-lg border cursor-pointer transition-colors",
                            previewVer?.id === h.id ? "bg-primary/10 border-primary/30" : "hover:bg-muted/50 border-transparent hover:border-border")}>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-semibold text-foreground">v{h.version}</span>
                            <button onClick={(e) => { e.stopPropagation(); rollback(h.id, h.version) }}
                              className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                              <RotateCcw className="w-3 h-3" /> Restore
                            </button>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(h.createdAt).toLocaleString()}</div>
                          {h.savedBy && <div className="text-[11px] text-muted-foreground truncate">{h.savedBy}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Version preview */}
                <div className="flex-1 overflow-y-auto p-4 min-w-0">
                  {previewVer ? (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[12px] font-semibold text-foreground">Preview v{previewVer.version}</span>
                        <span className="text-[11px] text-muted-foreground">{new Date(previewVer.createdAt).toLocaleString()}</span>
                        <button onClick={() => rollback(previewVer.id, previewVer.version)}
                          className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary text-[12px] font-medium hover:bg-primary/20 transition-colors">
                          <RotateCcw className="w-3.5 h-3.5" /> Restore this version
                        </button>
                      </div>
                      <pre className="text-[12px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">{previewVer.content}</pre>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-[12px]">
                      <div className="text-center"><History className="w-8 h-8 mx-auto mb-2 opacity-30" />Select a version to preview</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create file modal ───────────────────────────────────────────────── */}
      {showCreate && <CreateFileModal onClose={() => setShowCreate(false)} onCreated={async () => { setShowCreate(false); await fetchFiles() }} show={show} />}
    </div>
  )
}

// ─── Create File Modal ────────────────────────────────────────────────────────

function CreateFileModal({ onClose, onCreated, show }: { onClose: () => void; onCreated: () => Promise<void>; show: (m: string, t?: "success" | "error" | "warning") => void }) {
  const [name,     setName]    = useState("")
  const [type,     setType]    = useState<"system" | "rules" | "tools">("rules")
  const [content,  setContent] = useState("# New Agent File\n\n")
  const [creating, setCreating]= useState(false)

  const create = async () => {
    if (!name.trim())    { show("Name is required", "error"); return }
    if (!content.trim()) { show("Content is required", "error"); return }
    setCreating(true)
    try {
      const res  = await fetch("/api/agent/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, type, content }) })
      const data = await res.json()
      if (!res.ok) { show(data.error || "Failed to create", "error"); return }
      show(data.message || "File created", "success")
      await onCreated()
    } catch { show("Create failed", "error") }
    finally { setCreating(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Create New Agent File</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] font-medium text-muted-foreground block mb-1.5">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Core Safety Rules" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground outline-none focus:border-primary/50 transition-colors" />
          </div>
          <div>
            <label className="text-[12px] font-medium text-muted-foreground block mb-1.5">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(["system", "rules", "tools"] as const).map((t) => {
                const meta = TYPE_META[t]
                const Icon = meta.icon
                return (
                  <button key={t} onClick={() => setType(t)} className={cn("flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-all text-center", type === t ? cn(meta.bg, "border-opacity-100") : "bg-muted border-border opacity-60 hover:opacity-100")}>
                    <Icon className={cn("w-4 h-4", meta.color)} />
                    <span className={cn("text-[11px] font-semibold", meta.color)}>{meta.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">{TYPE_META[type].desc}</p>
          </div>
          <div>
            <label className="text-[12px] font-medium text-muted-foreground block mb-1.5">Content (Markdown)</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-[12px] font-mono text-foreground outline-none focus:border-primary/50 transition-colors resize-none" placeholder="# File content..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button onClick={create} disabled={creating} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create File
          </button>
        </div>
      </div>
    </div>
  )
}
