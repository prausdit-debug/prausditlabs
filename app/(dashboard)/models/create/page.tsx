"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Box, ArrowLeft, Loader2, Save, Sparkles } from "lucide-react"
import Link from "next/link"

interface Experiment { id: string; name: string }

const QUANTIZATIONS = ["NONE", "INT8", "INT4", "GPTQ", "GGUF", "AWQ"]
const FORMATS = ["GGUF", "ONNX", "TensorRT", "SafeTensors", "PyTorch", "HuggingFace"]

export default function CreateModelPage() {
  const router = useRouter()
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [form, setForm] = useState({
    name: "", version: "1.0.0", description: "", experimentId: "",
    parameterCount: "", quantization: "NONE", deploymentFormat: "SafeTensors",
    fileSizeBytes: "", notes: "",
  })
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/experiments").then(r => r.json()).then(d => setExperiments(Array.isArray(d) ? d : []))
  }, [])

  const handleSave = async () => {
    if (!form.name || !form.version) { setError("Name and version are required"); return }
    setSaving(true)
    setError("")
    const res = await fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        version: form.version,
        description: form.description,
        experimentId: form.experimentId || null,
        parameterCount: form.parameterCount || null,
        quantization: form.quantization,
        deploymentFormat: form.deploymentFormat,
        fileSizeBytes: form.fileSizeBytes || null,
        notes: form.notes,
      }),
    })
    setSaving(false)
    if (res.ok) router.push("/models")
    else { const d = await res.json(); setError(d.error || "Failed to create model") }
  }

  const generateWithAI = async () => {
    if (!form.name) { setError("Enter a name first"); return }
    setAiLoading(true)
    setError("")
    const res = await fetch("/api/ai-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "model", title: form.name }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.description) setForm(p => ({ ...p, description: data.description }))
      if (data.notes) setForm(p => ({ ...p, notes: data.notes }))
    } else {
      setError("AI generation failed. Check GOOGLE_API_KEY.")
    }
    setAiLoading(false)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-mono mb-2">
          <span className="text-amber-500">▸</span> MODELS
        </div>
        <div className="flex items-center gap-3 mb-1">
          <Link href="/models" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">Register Model Version</h1>
        </div>
        <p className="text-[14px] text-muted-foreground">Register a new trained model version.</p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/5 text-[13px] text-red-400">{error}</div>
      )}

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-foreground">Model Info</h3>
          <button
            onClick={generateWithAI}
            disabled={aiLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-400 text-[12px] hover:bg-amber-500/10 transition-colors disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate with AI
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-[11px] text-muted-foreground mb-1 block">Model Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Protroit-Agent-v1"
              className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Version *</label>
            <input
              value={form.version}
              onChange={e => setForm(p => ({ ...p, version: e.target.value }))}
              placeholder="1.0.0"
              className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50 font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">From Experiment</label>
            <select
              value={form.experimentId}
              onChange={e => setForm(p => ({ ...p, experimentId: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50"
            >
              <option value="">— None —</option>
              {experiments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Parameter Count</label>
            <input
              value={form.parameterCount}
              onChange={e => setForm(p => ({ ...p, parameterCount: e.target.value }))}
              placeholder="e.g. 1100000000"
              className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50 font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Quantization</label>
            <select
              value={form.quantization}
              onChange={e => setForm(p => ({ ...p, quantization: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50"
            >
              {QUANTIZATIONS.map(q => <option key={q}>{q}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Deployment Format</label>
            <select
              value={form.deploymentFormat}
              onChange={e => setForm(p => ({ ...p, deploymentFormat: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50"
            >
              {FORMATS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">File Size (bytes)</label>
            <input
              value={form.fileSizeBytes}
              onChange={e => setForm(p => ({ ...p, fileSizeBytes: e.target.value }))}
              placeholder="e.g. 4500000000"
              className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            rows={3}
            placeholder="Describe the model, its capabilities, and intended use…"
            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50 resize-none"
          />
        </div>

        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            rows={2}
            placeholder="Additional notes or observations…"
            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-[13px] outline-none focus:border-amber-500/50 resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-black text-[13px] font-semibold hover:bg-amber-400 transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Register Model
        </button>
        <Link href="/models" className="px-4 py-2.5 rounded-lg border border-border text-[13px] text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </Link>
      </div>
    </div>
  )
}
