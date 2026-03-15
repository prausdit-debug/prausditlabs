"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Edit3, Save, X, Loader2, Box, Trash2, Sparkles, Rocket } from "lucide-react"
import Link from "next/link"
import { ResourceMetadata } from "@/components/shared/resource-metadata"
import { AIEditDialog } from "@/components/editor/ai-edit-dialog"
import { useCurrentUser } from "@/components/auth/auth-guard"
import { cn } from "@/lib/utils"

interface ModelVersion {
  id: string
  name: string
  version: string
  description: string
  parameterCount?: string
  quantization?: string
  deploymentFormat?: string
  pass1Score?: number
  bleuScore?: number
  mmluScore?: number
  fileSizeBytes?: string
  isDeployed: boolean
  notes?: string
  createdAt: string
  updatedAt: string
  createdByUserId?: string | null
  createdByUserName?: string | null
  createdWithAIModel?: string | null
  lastEditedByUserId?: string | null
  lastEditedByUserName?: string | null
  lastEditedAt?: string | null
  editedWithAIModel?: string | null
  experiment?: { name: string } | null
}

export default function ModelDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [model, setModel] = useState<ModelVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ description: "", notes: "" })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [usedAIModel, setUsedAIModel] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/models/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setModel(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const startEdit = () => {
    if (!model) return
    setEditForm({
      description: model.description || "",
      notes: model.notes || "",
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!model) return
    setSaving(true)
    const res = await fetch(`/api/models/${id}`, {
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
      setModel(updated)
      setEditing(false)
      setUsedAIModel(null)
    }
    setSaving(false)
  }

  const toggleDeploy = async () => {
    if (!model) return
    const res = await fetch(`/api/models/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDeployed: !model.isDeployed }),
    })
    if (res.ok) {
      const updated = await res.json()
      setModel(updated)
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
    if (selectedText) {
      if (editForm.description.includes(selectedText)) {
        setEditForm(f => ({ ...f, description: f.description.replace(selectedText, newText) }))
      } else if (editForm.notes.includes(selectedText)) {
        setEditForm(f => ({ ...f, notes: f.notes.replace(selectedText, newText) }))
      }
      setUsedAIModel(modelName)
    }
    setAiDialogOpen(false)
    setSelectedText("")
  }, [selectedText, editForm])

  const handleDelete = async () => {
    if (!confirm("Delete this model permanently?")) return
    setDeleting(true)
    await fetch(`/api/models/${id}`, { method: "DELETE" })
    router.push("/models")
  }

  const formatBytes = (bytes: string | undefined) => {
    if (!bytes) return "N/A"
    const b = BigInt(bytes)
    if (b < 1024n) return `${b} B`
    if (b < 1024n * 1024n) return `${Number(b / 1024n).toFixed(1)} KB`
    if (b < 1024n * 1024n * 1024n) return `${Number(b / (1024n * 1024n)).toFixed(1)} MB`
    return `${Number(b / (1024n * 1024n * 1024n)).toFixed(2)} GB`
  }

  const formatParams = (params: string | undefined) => {
    if (!params) return "N/A"
    const p = BigInt(params)
    if (p >= 1_000_000_000n) return `${Number(p / 1_000_000_000n).toFixed(1)}B`
    if (p >= 1_000_000n) return `${Number(p / 1_000_000n).toFixed(1)}M`
    return p.toString()
  }

  if (loading) {
    return (
      <div className="max-w-4xl space-y-4">
        <div className="h-8 bg-muted rounded w-1/2 animate-pulse" />
        <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
      </div>
    )
  }

  if (!model) {
    return (
      <div className="text-center py-20">
        <p className="text-[14px] text-muted-foreground mb-4">Model not found.</p>
        <Link href="/models" className="text-amber-400 hover:text-amber-300 text-[13px]">Back to Models</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/models" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-mono">
            <span className="text-amber-500">&#9656;</span> MODELS
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <>
              <button
                onClick={toggleDeploy}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] transition-colors",
                  model.isDeployed 
                    ? "border-green-500/50 text-green-400 bg-green-500/10" 
                    : "border-border text-muted-foreground hover:text-foreground hover:border-amber-500/30"
                )}
              >
                <Rocket className="w-3.5 h-3.5" />
                {model.isDeployed ? "Deployed" : "Deploy"}
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
        <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center flex-shrink-0">
          <Box className="w-6 h-6 text-pink-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{model.name}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-pink-500/30 text-pink-400 bg-pink-500/10">
              v{model.version}
            </span>
            {model.isDeployed && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-green-500/30 text-green-400 bg-green-500/10">
                DEPLOYED
              </span>
            )}
            {model.quantization && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                {model.quantization}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metadata */}
      <ResourceMetadata
        createdByUserName={model.createdByUserName}
        createdAt={model.createdAt}
        createdWithAIModel={model.createdWithAIModel}
        lastEditedByUserName={model.lastEditedByUserName}
        lastEditedAt={model.lastEditedAt}
        editedWithAIModel={model.editedWithAIModel}
      />

      {/* Description */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-foreground">Description</h3>
        {editing ? (
          <textarea
            value={editForm.description}
            onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50 resize-none"
          />
        ) : (
          <p className="text-[13px] text-muted-foreground">{model.description || "No description provided."}</p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-[13px] font-semibold text-foreground">Model Details</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Parameters</p>
            <span className="text-[14px] font-bold font-mono text-foreground">{formatParams(model.parameterCount)}</span>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase">File Size</p>
            <span className="text-[14px] font-bold font-mono text-foreground">{formatBytes(model.fileSizeBytes)}</span>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Format</p>
            <span className="text-[14px] font-bold font-mono text-foreground">{model.deploymentFormat || "N/A"}</span>
          </div>
          {model.experiment && (
            <div className="bg-muted rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Experiment</p>
              <span className="text-[14px] font-bold font-mono text-foreground">{model.experiment.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Scores */}
      {(model.pass1Score || model.bleuScore || model.mmluScore) && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-[13px] font-semibold text-foreground">Benchmark Scores</h3>
          <div className="grid grid-cols-3 gap-3">
            {model.pass1Score && (
              <div className="bg-muted rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase">pass@1</p>
                <span className="text-[14px] font-bold font-mono text-foreground">{(model.pass1Score * 100).toFixed(1)}%</span>
              </div>
            )}
            {model.bleuScore && (
              <div className="bg-muted rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase">BLEU</p>
                <span className="text-[14px] font-bold font-mono text-foreground">{model.bleuScore.toFixed(2)}</span>
              </div>
            )}
            {model.mmluScore && (
              <div className="bg-muted rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase">MMLU</p>
                <span className="text-[14px] font-bold font-mono text-foreground">{(model.mmluScore * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-foreground">Notes</h3>
        {editing ? (
          <textarea
            value={editForm.notes}
            onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50 resize-none"
          />
        ) : (
          <p className="text-[13px] text-muted-foreground whitespace-pre-wrap">{model.notes || "No notes."}</p>
        )}
      </div>

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
