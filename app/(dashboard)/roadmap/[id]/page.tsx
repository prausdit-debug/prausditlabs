"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Edit3, Save, X, Loader2, Map, Trash2, Sparkles, CheckCircle2, Clock, Circle } from "lucide-react"
import Link from "next/link"
import { ResourceMetadata } from "@/components/shared/resource-metadata"
import { AIEditDialog } from "@/components/editor/ai-edit-dialog"
import { useCurrentUser } from "@/components/auth/auth-guard"
import { cn } from "@/lib/utils"

interface RoadmapTask {
  id: string
  title: string
  completed: boolean
}

interface RoadmapStep {
  id: string
  phase: number
  title: string
  description: string
  status: string
  priority?: string
  milestone?: string
  progressPercent: number
  estimatedCompletion?: string
  createdAt: string
  updatedAt: string
  createdByUserId?: string | null
  createdByUserName?: string | null
  createdWithAIModel?: string | null
  lastEditedByUserId?: string | null
  lastEditedByUserName?: string | null
  lastEditedAt?: string | null
  editedWithAIModel?: string | null
  tasks: RoadmapTask[]
}

const STATUS_CONFIG = {
  PENDING: { label: "Pending", icon: Circle, color: "text-muted-foreground", bg: "bg-muted" },
  IN_PROGRESS: { label: "In Progress", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
  COMPLETED: { label: "Completed", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10" },
}

export default function RoadmapDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [step, setStep] = useState<RoadmapStep | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: "", description: "", milestone: "", priority: "" })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [usedAIModel, setUsedAIModel] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/roadmap/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setStep(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const startEdit = () => {
    if (!step) return
    setEditForm({
      title: step.title,
      description: step.description || "",
      milestone: step.milestone || "",
      priority: step.priority || "",
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!step) return
    setSaving(true)
    const res = await fetch(`/api/roadmap/${id}`, {
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
      setStep(updated)
      setEditing(false)
      setUsedAIModel(null)
    }
    setSaving(false)
  }

  const updateStatus = async (status: string) => {
    if (!step) return
    const res = await fetch(`/api/roadmap/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setStep(updated)
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
    if (selectedText && editForm.description.includes(selectedText)) {
      setEditForm(f => ({ ...f, description: f.description.replace(selectedText, newText) }))
      setUsedAIModel(modelName)
    }
    setAiDialogOpen(false)
    setSelectedText("")
  }, [selectedText, editForm.description])

  const handleDelete = async () => {
    if (!confirm("Delete this roadmap step permanently?")) return
    setDeleting(true)
    await fetch(`/api/roadmap/${id}`, { method: "DELETE" })
    router.push("/roadmap")
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="h-8 bg-muted rounded w-1/2 animate-pulse" />
        <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
      </div>
    )
  }

  if (!step) {
    return (
      <div className="text-center py-20">
        <p className="text-[14px] text-muted-foreground mb-4">Roadmap step not found.</p>
        <Link href="/roadmap" className="text-amber-400 hover:text-amber-300 text-[13px]">Back to Roadmap</Link>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[step.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.PENDING
  const StatusIcon = statusConfig.icon

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/roadmap" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-mono">
            <span className="text-amber-500">&#9656;</span> ROADMAP
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
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <Map className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-mono mb-1">
            Phase {step.phase}
          </div>
          {editing ? (
            <input
              value={editForm.title}
              onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
              className="w-full text-2xl font-bold bg-transparent border-b border-amber-500/40 text-foreground outline-none pb-2"
            />
          ) : (
            <h1 className="text-2xl font-bold text-foreground">{step.title}</h1>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        <span className="text-[12px] text-muted-foreground">Status:</span>
        <div className="flex items-center gap-1">
          {(Object.keys(STATUS_CONFIG) as (keyof typeof STATUS_CONFIG)[]).map(s => {
            const cfg = STATUS_CONFIG[s]
            const Ic = cfg.icon
            return (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono border transition-all",
                  step.status === s ? `${cfg.color} ${cfg.bg} border-current` : "border-border text-muted-foreground hover:border-amber-500/30"
                )}
              >
                <Ic className="w-3 h-3" />
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Metadata */}
      <ResourceMetadata
        createdByUserName={step.createdByUserName}
        createdAt={step.createdAt}
        createdWithAIModel={step.createdWithAIModel}
        lastEditedByUserName={step.lastEditedByUserName}
        lastEditedAt={step.lastEditedAt}
        editedWithAIModel={step.editedWithAIModel}
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
          <p className="text-[13px] text-muted-foreground whitespace-pre-wrap">{step.description || "No description provided."}</p>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase mb-1">Milestone</p>
          {editing ? (
            <input
              value={editForm.milestone}
              onChange={e => setEditForm(p => ({ ...p, milestone: e.target.value }))}
              className="w-full text-[14px] font-medium bg-transparent border-b border-amber-500/40 text-foreground outline-none"
            />
          ) : (
            <span className="text-[14px] font-medium text-foreground">{step.milestone || "N/A"}</span>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase mb-1">Priority</p>
          {editing ? (
            <input
              value={editForm.priority}
              onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}
              className="w-full text-[14px] font-medium bg-transparent border-b border-amber-500/40 text-foreground outline-none"
            />
          ) : (
            <span className="text-[14px] font-medium text-foreground">{step.priority || "N/A"}</span>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] text-muted-foreground">Progress</p>
          <span className="text-[12px] font-mono text-foreground">{step.progressPercent}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-amber-500 rounded-full transition-all"
            style={{ width: `${step.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Tasks */}
      {step.tasks && step.tasks.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-[13px] font-semibold text-foreground">Tasks</h3>
          <div className="space-y-2">
            {step.tasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center",
                  task.completed ? "border-green-500 bg-green-500/20" : "border-muted-foreground"
                )}>
                  {task.completed && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                </div>
                <span className={cn(
                  "text-[13px]",
                  task.completed ? "text-muted-foreground line-through" : "text-foreground"
                )}>
                  {task.title}
                </span>
              </div>
            ))}
          </div>
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
