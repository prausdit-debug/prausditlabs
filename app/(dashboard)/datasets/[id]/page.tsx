"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Edit3, Save, X, Loader2, Database, Trash2, Sparkles, Tag, ExternalLink } from "lucide-react"
import Link from "next/link"
import { ResourceMetadata } from "@/components/shared/resource-metadata"
import { AIEditDialog } from "@/components/editor/ai-edit-dialog"
import { useCurrentUser } from "@/components/auth/auth-guard"
import { formatDate } from "@/lib/utils"

interface Dataset {
  id: string
  name: string
  description: string
  sourceUrl?: string
  datasetType: string
  numSamples?: number
  sizeBytes?: string
  format?: string
  license?: string
  tags: string[]
  preprocessStatus: string
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

export default function DatasetDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: "", description: "", sourceUrl: "", format: "", license: "" })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [usedAIModel, setUsedAIModel] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/datasets/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setDataset(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const startEdit = () => {
    if (!dataset) return
    setEditForm({
      name: dataset.name,
      description: dataset.description || "",
      sourceUrl: dataset.sourceUrl || "",
      format: dataset.format || "",
      license: dataset.license || "",
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!dataset) return
    setSaving(true)
    const res = await fetch(`/api/datasets/${id}`, {
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
      setDataset(updated)
      setEditing(false)
      setUsedAIModel(null)
    }
    setSaving(false)
  }

  const handleAIEdit = useCallback(() => {
    const selection = window.getSelection()?.toString() || ""
    if (selection.trim()) {
      setSelectedText(selection)
      setAiDialogOpen(true)
    }
  }, [])

  const handleAIAccept = useCallback((newText: string, modelName: string) => {
    if (selectedText && editForm.description.includes(selectedText)) {
      setEditForm(f => ({ ...f, description: f.description.replace(selectedText, newText) }))
      setUsedAIModel(modelName)
    }
    setAiDialogOpen(false)
    setSelectedText("")
  }, [selectedText, editForm.description])

  const handleDelete = async () => {
    if (!confirm("Delete this dataset permanently?")) return
    setDeleting(true)
    await fetch(`/api/datasets/${id}`, { method: "DELETE" })
    router.push("/datasets")
  }

  const formatBytes = (bytes: string | undefined) => {
    if (!bytes) return "N/A"
    const b = BigInt(bytes)
    if (b < 1024n) return `${b} B`
    if (b < 1024n * 1024n) return `${Number(b / 1024n).toFixed(1)} KB`
    if (b < 1024n * 1024n * 1024n) return `${Number(b / (1024n * 1024n)).toFixed(1)} MB`
    return `${Number(b / (1024n * 1024n * 1024n)).toFixed(2)} GB`
  }

  if (loading) {
    return (
      <div className="max-w-4xl space-y-4">
        <div className="h-8 bg-muted rounded w-1/2 animate-pulse" />
        <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
        <div className="space-y-2 mt-8">
          {[1,2,3].map(i => <div key={i} className="h-4 bg-muted rounded animate-pulse" style={{ width: `${90 - i * 10}%` }} />)}
        </div>
      </div>
    )
  }

  if (!dataset) {
    return (
      <div className="text-center py-20">
        <p className="text-[14px] text-muted-foreground mb-4">Dataset not found.</p>
        <Link href="/datasets" className="text-amber-400 hover:text-amber-300 text-[13px]">Back to Datasets</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/datasets" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-mono">
            <span className="text-amber-500">&#9656;</span> DATASETS
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <>
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
        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <Database className="w-6 h-6 text-cyan-400" />
        </div>
        <div className="flex-1">
          {editing ? (
            <input
              value={editForm.name}
              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
              className="w-full text-2xl font-bold bg-transparent border-b border-amber-500/40 text-foreground outline-none pb-2"
            />
          ) : (
            <h1 className="text-2xl font-bold text-foreground">{dataset.name}</h1>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
              {dataset.datasetType}
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-border text-muted-foreground">
              {dataset.preprocessStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <ResourceMetadata
        createdByUserName={dataset.createdByUserName}
        createdAt={dataset.createdAt}
        createdWithAIModel={dataset.createdWithAIModel}
        lastEditedByUserName={dataset.lastEditedByUserName}
        lastEditedAt={dataset.lastEditedAt}
        editedWithAIModel={dataset.editedWithAIModel}
      />

      {/* Description */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-foreground">Description</h3>
        {editing ? (
          <textarea
            value={editForm.description}
            onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50 resize-none"
          />
        ) : (
          <p className="text-[13px] text-muted-foreground">{dataset.description || "No description provided."}</p>
        )}
      </div>

      {/* Info Grid */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-[13px] font-semibold text-foreground">Dataset Details</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Samples</p>
            <span className="text-[14px] font-bold font-mono text-foreground">{dataset.numSamples?.toLocaleString() || "N/A"}</span>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Size</p>
            <span className="text-[14px] font-bold font-mono text-foreground">{formatBytes(dataset.sizeBytes)}</span>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Format</p>
            {editing ? (
              <input
                value={editForm.format}
                onChange={e => setEditForm(p => ({ ...p, format: e.target.value }))}
                className="w-full text-[14px] font-bold font-mono bg-transparent border-b border-amber-500/40 text-foreground outline-none"
              />
            ) : (
              <span className="text-[14px] font-bold font-mono text-foreground">{dataset.format || "N/A"}</span>
            )}
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase">License</p>
            {editing ? (
              <input
                value={editForm.license}
                onChange={e => setEditForm(p => ({ ...p, license: e.target.value }))}
                className="w-full text-[14px] font-bold font-mono bg-transparent border-b border-amber-500/40 text-foreground outline-none"
              />
            ) : (
              <span className="text-[14px] font-bold font-mono text-foreground">{dataset.license || "N/A"}</span>
            )}
          </div>
        </div>
      </div>

      {/* Source URL */}
      {(dataset.sourceUrl || editing) && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <h3 className="text-[13px] font-semibold text-foreground">Source URL</h3>
          {editing ? (
            <input
              value={editForm.sourceUrl}
              onChange={e => setEditForm(p => ({ ...p, sourceUrl: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50"
            />
          ) : dataset.sourceUrl ? (
            <a
              href={dataset.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] text-amber-400 hover:text-amber-300"
            >
              {dataset.sourceUrl}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : null}
        </div>
      )}

      {/* Tags */}
      {dataset.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {dataset.tags.map(tag => (
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
