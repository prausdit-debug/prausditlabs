"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Edit3, Save, X, Loader2, FlaskConical, Trash2, Sparkles, TrendingDown } from "lucide-react"
import Link from "next/link"
import { ResourceMetadata } from "@/components/shared/resource-metadata"
import { AIEditDialog } from "@/components/editor/ai-edit-dialog"
import { useCurrentUser } from "@/components/auth/auth-guard"
import { cn, formatDate, getStatusColor } from "@/lib/utils"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

interface ExperimentLog { step: number; loss: number | null }
interface Experiment {
  id: string
  name: string
  description?: string
  baseModel: string
  status: string
  loraRank?: number
  loraAlpha?: number
  batchSize?: number
  learningRate?: number
  epochs?: number
  evalLoss?: number
  evalAccuracy?: number
  pass1Score?: number
  bleuScore?: number
  method?: string
  resultSummary?: string
  createdAt: string
  updatedAt: string
  createdByUserId?: string | null
  createdByUserName?: string | null
  createdWithAIModel?: string | null
  lastEditedByUserId?: string | null
  lastEditedByUserName?: string | null
  lastEditedAt?: string | null
  editedWithAIModel?: string | null
  logs: ExperimentLog[]
  dataset?: { name: string } | null
}

export default function ExperimentDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: "", description: "", method: "", resultSummary: "" })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [usedAIModel, setUsedAIModel] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/experiments/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setExperiment(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const startEdit = () => {
    if (!experiment) return
    setEditForm({
      name: experiment.name,
      description: experiment.description || "",
      method: experiment.method || "",
      resultSummary: experiment.resultSummary || "",
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!experiment) return
    setSaving(true)
    const res = await fetch(`/api/experiments/${id}`, {
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
      setExperiment(updated)
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
    if (selectedText) {
      if (editForm.description.includes(selectedText)) {
        setEditForm(f => ({ ...f, description: f.description.replace(selectedText, newText) }))
      } else if (editForm.resultSummary.includes(selectedText)) {
        setEditForm(f => ({ ...f, resultSummary: f.resultSummary.replace(selectedText, newText) }))
      } else if (editForm.method.includes(selectedText)) {
        setEditForm(f => ({ ...f, method: f.method.replace(selectedText, newText) }))
      }
      setUsedAIModel(modelName)
    }
    setAiDialogOpen(false)
    setSelectedText("")
  }, [selectedText, editForm])

  const handleDelete = async () => {
    if (!confirm("Delete this experiment permanently?")) return
    setDeleting(true)
    await fetch(`/api/experiments/${id}`, { method: "DELETE" })
    router.push("/experiments")
  }

  if (loading) {
    return (
      <div className="max-w-4xl space-y-4">
        <div className="h-8 bg-muted rounded w-1/2 animate-pulse" />
        <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
        <div className="space-y-2 mt-8">
          {[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-muted rounded animate-pulse" style={{ width: `${90 - i * 8}%` }} />)}
        </div>
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="text-center py-20">
        <p className="text-[14px] text-muted-foreground mb-4">Experiment not found.</p>
        <Link href="/experiments" className="text-amber-400 hover:text-amber-300 text-[13px]">Back to Experiments</Link>
      </div>
    )
  }

  const chartData = experiment.logs
    ?.filter(l => l.loss !== null)
    .map(l => ({ step: l.step, loss: Number(l.loss?.toFixed(4)) })) || []

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/experiments" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-mono">
            <span className="text-amber-500">&#9656;</span> EXPERIMENTS
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

      {/* Title and Status */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <FlaskConical className="w-6 h-6 text-violet-400" />
        </div>
        <div className="flex-1">
          {editing ? (
            <input
              value={editForm.name}
              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
              className="w-full text-2xl font-bold bg-transparent border-b border-amber-500/40 text-foreground outline-none pb-2"
            />
          ) : (
            <h1 className="text-2xl font-bold text-foreground">{experiment.name}</h1>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className={cn("text-[11px] font-mono px-2 py-0.5 rounded-full border", getStatusColor(experiment.status))}>
              {experiment.status}
            </span>
            <span className="text-[12px] text-muted-foreground font-mono">{experiment.baseModel}</span>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <ResourceMetadata
        createdByUserName={experiment.createdByUserName}
        createdAt={experiment.createdAt}
        createdWithAIModel={experiment.createdWithAIModel}
        lastEditedByUserName={experiment.lastEditedByUserName}
        lastEditedAt={experiment.lastEditedAt}
        editedWithAIModel={experiment.editedWithAIModel}
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
          <p className="text-[13px] text-muted-foreground">{experiment.description || "No description provided."}</p>
        )}

        <h3 className="text-[13px] font-semibold text-foreground pt-2">Method / Technique</h3>
        {editing ? (
          <input
            value={editForm.method}
            onChange={e => setEditForm(p => ({ ...p, method: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50"
          />
        ) : (
          <p className="text-[13px] text-muted-foreground">{experiment.method || "Not specified."}</p>
        )}

        <h3 className="text-[13px] font-semibold text-foreground pt-2">Result Summary</h3>
        {editing ? (
          <textarea
            value={editForm.resultSummary}
            onChange={e => setEditForm(p => ({ ...p, resultSummary: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50 resize-none"
          />
        ) : (
          <p className="text-[13px] text-muted-foreground">{experiment.resultSummary || "No results recorded yet."}</p>
        )}
      </div>

      {/* Training Config */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-[13px] font-semibold text-foreground">Training Configuration</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["LoRA Rank", experiment.loraRank, "r"],
            ["LoRA Alpha", experiment.loraAlpha, "a"],
            ["Batch Size", experiment.batchSize, "bs"],
            ["Learning Rate", experiment.learningRate?.toExponential(0), "lr"],
            ["Epochs", experiment.epochs, "ep"],
            ["eval_loss", experiment.evalLoss?.toFixed(4), "loss"],
            ["eval_accuracy", experiment.evalAccuracy ? `${(experiment.evalAccuracy * 100).toFixed(1)}%` : null, "%"],
            ["pass@1", experiment.pass1Score ? `${(experiment.pass1Score * 100).toFixed(1)}%` : null, "He"],
          ].filter(([, v]) => v !== null && v !== undefined).map(([label, value, badge]) => (
            <div key={label as string} className="bg-muted rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase">{label as string}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[11px] text-amber-500/80 font-mono bg-amber-500/10 px-1 rounded">{badge as string}</span>
                <span className="text-[14px] font-bold font-mono text-foreground">{value as string}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Loss Curve */}
      {chartData.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-amber-400" />
            <p className="text-[13px] font-semibold text-foreground">Training Loss Curve</p>
          </div>
          <div className="h-48 bg-muted/30 rounded-lg p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
                <XAxis dataKey="step" tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: "hsl(0 0% 6%)", border: "1px solid hsl(0 0% 15%)", borderRadius: "6px", fontSize: "12px" }}
                  labelStyle={{ color: "hsl(0 0% 80%)" }}
                />
                <Line type="monotone" dataKey="loss" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
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
