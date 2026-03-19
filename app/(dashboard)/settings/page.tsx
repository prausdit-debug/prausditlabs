"use client"

import { useState, useEffect, useCallback } from "react"
import { useUser } from "@clerk/nextjs"
import {
  Settings, Key, Cpu, User, Shield, CheckCircle2,
  XCircle, Loader2, Eye, EyeOff, RefreshCw, Zap,
  Star, Lock, ChevronRight, AlertTriangle, Globe, MessageSquare,
  FileCode2, Search, Image, Server, Link2,
} from "lucide-react"
import { AgentFilesPanel } from "@/components/project/agent-files-panel"

// ─── Types ───────────────────────────────────────────────────────────────────

interface AISettingsData {
  defaultProvider:           string
  geminiDefaultModel:        string
  selectedOpenRouterModels:  string[]
  hasGeminiKey:              boolean
  hasOpenRouterKey:          boolean
  hasTavilyKey:              boolean
  hasBraveKey:               boolean
  hasSerpApiKey:             boolean
  hasFirecrawlKey:           boolean
  hasCrawl4aiUrl:            boolean
  crawl4aiUrl:               string | null
  hasCloudinaryCloudName:    boolean
  hasCloudinaryUploadPreset: boolean
  hasCloudinaryApiKey:       boolean
  cloudinaryCloudName:       string | null
}

interface ORModel { id: string; name: string; provider: string; free: boolean }

type ModelCategory = "chat" | "image" | "multimodal"
interface GeminiModelConfig { id: string; name: string; tier: "Free" | "Paid"; category: ModelCategory }

interface TestStatus { type: "success" | "error" | "loading" | null; message: string }

// ─── Constants ───────────────────────────────────────────────────────────────

const GEMINI_CHAT_MODELS: GeminiModelConfig[] = [
  { id: "auto",                          name: "Auto (Best Model)",        tier: "Free", category: "chat" },
  { id: "gemini-3.1-pro-preview",        name: "Gemini 3.1 Pro Preview",   tier: "Paid", category: "chat" },
  { id: "gemini-3-flash-preview",        name: "Gemini 3 Flash Preview",   tier: "Free", category: "chat" },
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite",    tier: "Free", category: "chat" },
  { id: "gemini-2.5-pro",                name: "Gemini 2.5 Pro",           tier: "Paid", category: "chat" },
  { id: "gemini-2.5-flash",              name: "Gemini 2.5 Flash",         tier: "Free", category: "chat" },
  { id: "gemini-2.5-flash-lite",         name: "Gemini 2.5 Flash Lite",    tier: "Free", category: "chat" },
  { id: "gemini-2.5-flash-live",         name: "Gemini 2.5 Flash Live",    tier: "Free", category: "chat" },
]
const GEMINI_IMAGE_MODELS: GeminiModelConfig[] = [
  { id: "auto-image",             name: "Auto (Best Image)",      tier: "Free", category: "image" },
  { id: "gemini-3.1-flash-image", name: "Gemini 3.1 Flash Image", tier: "Paid", category: "image" },
  { id: "imagen-4",               name: "Imagen 4",               tier: "Paid", category: "image" },
]
const GEMINI_MULTIMODAL_MODELS: GeminiModelConfig[] = [
  { id: "auto-multimodal",            name: "Auto (Best Multimodal)", tier: "Free", category: "multimodal" },
  { id: "gemini-embedding-2-preview", name: "Gemini Embedding 2",     tier: "Paid", category: "multimodal" },
  { id: "veo-3.1-preview",            name: "Veo 3.1 Preview",        tier: "Paid", category: "multimodal" },
]
const GEMINI_MODELS = GEMINI_CHAT_MODELS.filter(m => !m.id.startsWith("auto"))

const ADMIN_ROLES = ["super_admin", "admin"]
const ROLE_DISPLAY: Record<string, string> = { super_admin: "Super Admin", admin: "Admin", developer: "Developer", user: "User" }
const ROLE_COLOR: Record<string, string> = {
  super_admin: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  admin:       "text-blue-400 bg-blue-500/10 border-blue-500/30",
  developer:   "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  user:        "text-zinc-400 bg-zinc-500/10 border-zinc-500/30",
}

type TabId = "account" | "ai-providers" | "agent-files"
const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "account",      label: "Account",     icon: User      },
  { id: "ai-providers", label: "Manage API",  icon: Cpu       },
  { id: "agent-files",  label: "Agent Files", icon: FileCode2 },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: "Free" | "Paid" }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
      tier === "Free" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-amber-400 bg-amber-500/10 border-amber-500/30"
    }`}>{tier}</span>
  )
}

function StatusMsg({ status }: { status: { type: "success" | "error" | null; message: string } }) {
  if (!status.type) return null
  return (
    <div className={`flex items-center gap-2 text-[12px] px-3 py-2 rounded-lg border ${
      status.type === "success" ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/20" : "text-red-400 bg-red-500/5 border-red-500/20"
    }`}>
      {status.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
      {status.message}
    </div>
  )
}

type AccentColor = "amber" | "blue" | "purple" | "emerald"
const ACCENT: Record<AccentColor, string> = {
  amber:   "bg-amber-500/10 border-amber-500/20 text-amber-400",
  blue:    "bg-blue-500/10 border-blue-500/20 text-blue-400",
  purple:  "bg-purple-500/10 border-purple-500/20 text-purple-400",
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
}

function SectionCard({ title, icon: Icon, children, locked, accent = "amber" }: {
  title: string; icon: React.ElementType; children: React.ReactNode; locked?: boolean; accent?: AccentColor
}) {
  return (
    <div className={`rounded-xl border border-border bg-card/50 overflow-hidden ${locked ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${ACCENT[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
        {locked && <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground"><Lock className="w-3 h-3" /><span>Admin only</span></div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Reusable Tool Key Row ────────────────────────────────────────────────────

function ToolKeyRow({
  label, placeholder, hint, value, onChange, hasSaved, isPassword = true,
  onSave, onTest, saving, testStatus, disabled, docsUrl,
}: {
  label: string; placeholder: string; hint?: string; value: string
  onChange: (v: string) => void; hasSaved: boolean; isPassword?: boolean
  onSave: () => Promise<void>; onTest: () => Promise<void>
  saving: boolean; testStatus: TestStatus; disabled: boolean; docsUrl?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-2.5 pb-5 border-b border-border/50 last:border-0 last:pb-0">
      <div className="flex items-center gap-2">
        <label className="text-[12px] font-semibold text-foreground">{label}</label>
        {hasSaved && <span className="text-[10px] text-emerald-400 font-medium border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.5 rounded-full">Saved ✓</span>}
        {docsUrl && (
          <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <Link2 className="w-3 h-3" /> Docs
          </a>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 focus-within:border-primary/40 transition-colors">
        <Key className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          type={isPassword && !show ? "password" : "text"}
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={hasSaved ? "Enter new value to update" : placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onSave} disabled={!value.trim() || disabled || saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />} Save
        </button>
        <button onClick={onTest} disabled={testStatus.type === "loading"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-[12px] text-foreground hover:bg-accent transition-colors disabled:opacity-50">
          {testStatus.type === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Test
        </button>
        {testStatus.type && testStatus.type !== "loading" && (
          <span className={`text-[12px] flex items-center gap-1 ${testStatus.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
            {testStatus.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {testStatus.message}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, isLoaded } = useUser()
  const [activeTab, setActiveTab] = useState<TabId>("account")
  const [settings, setSettings]   = useState<AISettingsData | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [userRole, setUserRole]   = useState<string | null>(null)
  const canEdit = userRole ? ADMIN_ROLES.includes(userRole) : false

  // Gemini
  const [geminiKey, setGeminiKey]     = useState("")
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [geminiKeyStatus, setGeminiKeyStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" })
  const [testingGemini, setTestingGemini] = useState(false)
  const [savingGemini, setSavingGemini]   = useState(false)
  const [selectedGeminiModel, setSelectedGeminiModel] = useState("gemini-2.5-flash")

  // OpenRouter
  const [orKey, setOrKey]         = useState("")
  const [showOrKey, setShowOrKey] = useState(false)
  const [orKeyStatus, setOrKeyStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" })
  const [testingOR, setTestingOR] = useState(false)
  const [savingOR, setSavingOR]   = useState(false)
  const [orModels, setOrModels]   = useState<{ free: ORModel[]; pro: ORModel[] }>({ free: [], pro: [] })
  const [loadingModels, setLoadingModels] = useState(false)
  const [selectedORModels, setSelectedORModels] = useState<string[]>([])
  const [defaultProvider, setDefaultProvider] = useState<"gemini" | "openrouter">("gemini")
  const [savingProvider, setSavingProvider]   = useState(false)

  // Research – search providers
  const [tavilyKey, setTavilyKey] = useState(""); const [savingTavily, setSavingTavily] = useState(false); const [testTavily, setTestTavily] = useState<TestStatus>({ type: null, message: "" })
  const [braveKey,  setBraveKey]  = useState(""); const [savingBrave,  setSavingBrave]  = useState(false); const [testBrave,  setTestBrave]  = useState<TestStatus>({ type: null, message: "" })
  const [serpKey,   setSerpKey]   = useState(""); const [savingSerp,   setSavingSerp]   = useState(false); const [testSerp,   setTestSerp]   = useState<TestStatus>({ type: null, message: "" })

  // Research – crawl providers
  const [firecrawlKey, setFirecrawlKey] = useState(""); const [savingFirecrawl, setSavingFirecrawl] = useState(false); const [testFirecrawl, setTestFirecrawl] = useState<TestStatus>({ type: null, message: "" })
  const [crawl4aiUrl,  setCrawl4aiUrl]  = useState(""); const [savingCrawl4ai,  setSavingCrawl4ai]  = useState(false); const [testCrawl4ai,  setTestCrawl4ai]  = useState<TestStatus>({ type: null, message: "" })

  // Cloudinary
  const [cloudName,   setCloudName]   = useState("")
  const [cloudPreset, setCloudPreset] = useState("")
  const [cloudApiKey, setCloudApiKey] = useState("")
  const [savingCloud, setSavingCloud] = useState(false)
  const [testCloud,   setTestCloud]   = useState<TestStatus>({ type: null, message: "" })

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    try {
      setLoadingSettings(true)
      const res = await fetch("/api/settings")
      if (res.ok) {
        const data: AISettingsData = await res.json()
        setSettings(data)
        setDefaultProvider((data.defaultProvider as "gemini" | "openrouter") || "gemini")
        setSelectedGeminiModel(data.geminiDefaultModel || "gemini-2.5-flash")
        setSelectedORModels(data.selectedOpenRouterModels || [])
        if (data.crawl4aiUrl)         setCrawl4aiUrl(data.crawl4aiUrl)
        if (data.cloudinaryCloudName) setCloudName(data.cloudinaryCloudName)
      }
    } catch { /* ignore */ } finally { setLoadingSettings(false) }
  }, [])

  useEffect(() => {
    if (!user) return
    fetch("/api/users").then(r => r.json()).then(data => {
      const u = Array.isArray(data) ? data.find((u: { clerkId: string; role: string }) => u.clerkId === user.id) : null
      if (u) setUserRole(u.role)
    }).catch(() => {})
  }, [user])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  useEffect(() => {
    if (activeTab === "ai-providers") {
      setLoadingModels(true)
      fetch("/api/openrouter-models").then(r => r.json()).then(data => setOrModels({ free: data.free || [], pro: data.pro || [] })).catch(() => {}).finally(() => setLoadingModels(false))
    }
  }, [activeTab])

  // ── Helpers ──────────────────────────────────────────────────────────────

  const saveKey = async (fields: Record<string, string | null>) => {
    const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Save failed") }
    await fetchSettings()
  }

  const testProvider = async (provider: string, setStatus: (s: TestStatus) => void, apiKey?: string, apiUrl?: string) => {
    setStatus({ type: "loading", message: "Testing…" })
    try {
      const res  = await fetch("/api/settings/test-tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, apiKey, apiUrl }) })
      const data = await res.json()
      setStatus({ type: data.success ? "success" : "error", message: data.message || data.error })
    } catch (e) { setStatus({ type: "error", message: String(e) }) }
  }

  // Gemini / OR (unchanged logic)
  const saveGeminiKey = async () => {
    if (!geminiKey.trim()) return; setSavingGemini(true)
    try {
      const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ geminiApiKey: geminiKey, geminiDefaultModel: selectedGeminiModel }) })
      if (res.ok) { setGeminiKeyStatus({ type: "success", message: "Gemini API key saved successfully" }); setGeminiKey(""); fetchSettings() }
      else { const e = await res.json(); setGeminiKeyStatus({ type: "error", message: e.error || "Failed to save" }) }
    } catch { setGeminiKeyStatus({ type: "error", message: "Network error" }) } finally { setSavingGemini(false) }
  }
  const testGemini = async () => {
    setTestingGemini(true); setGeminiKeyStatus({ type: null, message: "" })
    try {
      const res  = await fetch("/api/settings/test-gemini", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: geminiKey || undefined }) })
      const data = await res.json()
      setGeminiKeyStatus({ type: data.success ? "success" : "error", message: data.success ? data.message : data.error })
    } catch { setGeminiKeyStatus({ type: "error", message: "Connection test failed" }) } finally { setTestingGemini(false) }
  }
  const saveORKey = async () => {
    if (!orKey.trim()) return; setSavingOR(true)
    try {
      const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ openrouterApiKey: orKey, selectedOpenRouterModels: selectedORModels }) })
      if (res.ok) {
        setOrKeyStatus({ type: "success", message: "OpenRouter API key saved successfully" }); setOrKey(""); fetchSettings()
        setLoadingModels(true); fetch("/api/openrouter-models").then(r => r.json()).then(d => setOrModels({ free: d.free || [], pro: d.pro || [] })).finally(() => setLoadingModels(false))
      } else { const e = await res.json(); setOrKeyStatus({ type: "error", message: e.error || "Failed to save" }) }
    } catch { setOrKeyStatus({ type: "error", message: "Network error" }) } finally { setSavingOR(false) }
  }
  const testOpenRouter = async () => {
    setTestingOR(true); setOrKeyStatus({ type: null, message: "" })
    try {
      const res  = await fetch("/api/settings/test-openrouter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: orKey || undefined }) })
      const data = await res.json()
      setOrKeyStatus({ type: data.success ? "success" : "error", message: data.success ? data.message : data.error })
    } catch { setOrKeyStatus({ type: "error", message: "Connection test failed" }) } finally { setTestingOR(false) }
  }
  const saveDefaultProvider = async (p: "gemini" | "openrouter") => {
    setSavingProvider(true); setDefaultProvider(p)
    try { await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultProvider: p }) }); fetchSettings() }
    catch { /* ignore */ } finally { setSavingProvider(false) }
  }
  const saveGeminiModel = async (model: string) => {
    setSelectedGeminiModel(model)
    try { await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ geminiDefaultModel: model }) }) } catch { /* ignore */ }
  }
  const toggleORModel = async (modelId: string) => {
    const updated = selectedORModels.includes(modelId) ? selectedORModels.filter(m => m !== modelId) : selectedORModels.length >= 5 ? [...selectedORModels.slice(1), modelId] : [...selectedORModels, modelId]
    setSelectedORModels(updated)
    try { await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selectedOpenRouterModels: updated }) }) } catch { /* ignore */ }
  }

  if (!isLoaded) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
  const clerkRole = (user?.publicMetadata?.role as string) || userRole || "user"

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">

      {/* Header */}
      <div className="px-6 py-5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-foreground">Settings</h1>
            <p className="text-[12px] text-muted-foreground">Manage your account, AI providers, tools, and agent configuration</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 flex-shrink-0">
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border w-fit">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all ${
                activeTab === tab.id ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
              }`}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === "agent-files" && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/25 text-purple-400">New</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 py-5 space-y-5">

        {/* ══════ ACCOUNT TAB ══════ */}
        {activeTab === "account" && (
          <>
            <SectionCard title="Account Status" icon={User}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative flex-shrink-0">
                  {user?.imageUrl ? <img src={user.imageUrl} alt={user.fullName || ""} className="w-16 h-16 rounded-full border-2 border-amber-500/30" />
                    : <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500/30 flex items-center justify-center"><User className="w-8 h-8 text-amber-400" /></div>}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-card flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="text-[16px] font-bold text-foreground">{user?.fullName || user?.firstName || "—"}</h2>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_COLOR[clerkRole] || ROLE_COLOR.user}`}>{ROLE_DISPLAY[clerkRole] || clerkRole}</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground">{user?.primaryEmailAddress?.emailAddress || "—"}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Clerk ID: <code className="font-mono text-amber-400/70">{user?.id?.slice(0, 20)}…</code></p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[{ label: "Full Name", value: user?.fullName || "Not set" }, { label: "Email", value: user?.primaryEmailAddress?.emailAddress || "—" }, { label: "Role", value: ROLE_DISPLAY[clerkRole] || clerkRole }, { label: "Member Since", value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—" }].map(item => (
                  <div key={item.label} className="rounded-lg bg-muted/30 border border-border px-4 py-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">{item.label}</p>
                    <p className="text-[13px] text-foreground font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
            <SectionCard title="Permissions" icon={Shield}>
              <div className="space-y-2">
                {[
                  { label: "View Dashboard",        allowed: true },
                  { label: "Create / Edit Content", allowed: true },
                  { label: "Manage AI Settings",    allowed: canEdit },
                  { label: "Manage Agent Files",    allowed: canEdit },
                  { label: "Manage Users",          allowed: ["super_admin", "admin"].includes(clerkRole) },
                  { label: "Change Roles",          allowed: clerkRole === "super_admin" },
                ].map(perm => (
                  <div key={perm.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-[13px] text-foreground">{perm.label}</span>
                    {perm.allowed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-zinc-600" />}
                  </div>
                ))}
              </div>
            </SectionCard>
          </>
        )}

        {/* ══════ MANAGE API TAB ══════ */}
        {activeTab === "ai-providers" && (
          <>
            {!canEdit && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-[13px]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>You need <strong>Admin</strong> or <strong>Super Admin</strong> role to modify settings.</span>
              </div>
            )}

            {/* Default Provider */}
            <SectionCard title="Default AI Provider" icon={Zap} locked={!canEdit}>
              <p className="text-[12px] text-muted-foreground mb-4">Choose which AI provider powers the chat assistant by default.</p>
              <div className="grid grid-cols-2 gap-3">
                {(["gemini", "openrouter"] as const).map(p => (
                  <button key={p} disabled={!canEdit || savingProvider} onClick={() => saveDefaultProvider(p)}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${defaultProvider === p ? "border-amber-500/60 bg-amber-500/10 text-amber-400" : "border-border bg-muted/30 text-muted-foreground hover:border-border/80"} disabled:cursor-not-allowed`}>
                    {p === "gemini" ? <Cpu className="w-6 h-6" /> : <Globe className="w-6 h-6" />}
                    <span className="text-[13px] font-semibold">{p === "openrouter" ? "OpenRouter" : "Gemini"}</span>
                    {defaultProvider === p && <div className="absolute top-2 right-2"><CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /></div>}
                    {loadingSettings && <Loader2 className="absolute bottom-2 right-2 w-3 h-3 animate-spin" />}
                  </button>
                ))}
              </div>
              {settings && <p className="mt-3 text-[11px] text-muted-foreground">Current: <span className="text-amber-400 font-medium capitalize">{settings.defaultProvider}</span></p>}
            </SectionCard>

            {/* Gemini */}
            <SectionCard title="Gemini API" icon={Key} locked={!canEdit}>
              <div className="space-y-3">
                <div>
                  <label className="text-[12px] text-muted-foreground font-medium mb-1.5 block">API Key {settings?.hasGeminiKey && <span className="text-emerald-400 ml-1">· Key saved ✓</span>}</label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 focus-within:border-amber-500/40">
                    <Key className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <input type={showGeminiKey ? "text" : "password"} value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder={settings?.hasGeminiKey ? "Enter new key to update" : "AIzaSy…"} disabled={!canEdit} className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed" />
                    <button type="button" onClick={() => setShowGeminiKey(v => !v)} className="text-muted-foreground hover:text-foreground">{showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={saveGeminiKey} disabled={!geminiKey.trim() || !canEdit || savingGemini} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-black text-[12px] font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {savingGemini ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />} Update API Key
                  </button>
                  <button onClick={testGemini} disabled={testingGemini} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-muted/50 text-[12px] text-foreground hover:bg-accent transition-colors disabled:opacity-50">
                    {testingGemini ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Test Connection
                  </button>
                </div>
                <StatusMsg status={geminiKeyStatus} />
              </div>
              <div className="mt-6 space-y-6">
                {[{ label: "Chat Models", models: GEMINI_CHAT_MODELS, colorKey: "amber" }, { label: "Image Models", models: GEMINI_IMAGE_MODELS, colorKey: "blue" }, { label: "Multimodal Models", models: GEMINI_MULTIMODAL_MODELS, colorKey: "emerald" }].map(({ label, models, colorKey }) => (
                  <div key={label}>
                    <h4 className="text-[13px] font-semibold text-foreground mb-3 flex items-center gap-2">
                      {colorKey === "amber" ? <MessageSquare className="w-3.5 h-3.5 text-amber-400" /> : colorKey === "blue" ? <Zap className="w-3.5 h-3.5 text-blue-400" /> : <Cpu className="w-3.5 h-3.5 text-emerald-400" />}
                      {label}
                    </h4>
                    <div className="space-y-2">
                      {models.map(model => (
                        <button key={model.id} disabled={!canEdit} onClick={() => saveGeminiModel(model.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${selectedGeminiModel === model.id ? `border-${colorKey}-500/50 bg-${colorKey}-500/10` : "border-border bg-muted/20 hover:border-border/80 hover:bg-muted/30"} disabled:cursor-not-allowed`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selectedGeminiModel === model.id ? `border-${colorKey}-500` : "border-muted-foreground/40"}`}>
                            {selectedGeminiModel === model.id && <div className={`w-2 h-2 rounded-full bg-${colorKey}-500`} />}
                          </div>
                          <span className="flex-1 text-[13px] text-foreground">{model.name}</span>
                          <TierBadge tier={model.tier} />
                          {selectedGeminiModel === model.id && <span className="text-[10px] text-amber-400 font-medium">Default</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* OpenRouter */}
            <SectionCard title="OpenRouter API" icon={Globe} locked={!canEdit}>
              <div className="space-y-3">
                <div>
                  <label className="text-[12px] text-muted-foreground font-medium mb-1.5 block">API Key {settings?.hasOpenRouterKey && <span className="text-emerald-400 ml-1">· Key saved ✓</span>}</label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 focus-within:border-amber-500/40">
                    <Key className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <input type={showOrKey ? "text" : "password"} value={orKey} onChange={e => setOrKey(e.target.value)} placeholder={settings?.hasOpenRouterKey ? "Enter new key to update" : "sk-or-…"} disabled={!canEdit} className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed" />
                    <button type="button" onClick={() => setShowOrKey(v => !v)} className="text-muted-foreground hover:text-foreground">{showOrKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={saveORKey} disabled={!orKey.trim() || !canEdit || savingOR} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-black text-[12px] font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {savingOR ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />} Update API Key
                  </button>
                  <button onClick={testOpenRouter} disabled={testingOR} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-muted/50 text-[12px] text-foreground hover:bg-accent transition-colors disabled:opacity-50">
                    {testingOR ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Test Connection
                  </button>
                </div>
                <StatusMsg status={orKeyStatus} />
              </div>
              <div className="mt-3 text-[12px] text-muted-foreground px-3 py-2 rounded-lg bg-muted/20 border border-border">
                <strong className="text-foreground">Model selection:</strong> Select up to 5 models.
                {selectedORModels.length > 0 && <span className="ml-2 text-amber-400">{selectedORModels.length}/5 selected</span>}
              </div>
              {loadingModels ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-[12px]">Loading models…</span></div>
              ) : (
                <div className="mt-5 space-y-5">
                  {[{ label: "Top Free Models", tier: "Free" as const, models: orModels.free }, { label: "Top Pro Models", tier: "Paid" as const, models: orModels.pro }].map(({ label, tier, models }) => (
                    <div key={label}>
                      <div className="flex items-center gap-2 mb-3"><h4 className="text-[13px] font-semibold text-foreground">{label}</h4><TierBadge tier={tier} />{tier === "Paid" && <Star className="w-3.5 h-3.5 text-amber-400" />}</div>
                      <div className="space-y-2">
                        {models.map(model => {
                          const isSel = selectedORModels.includes(model.id)
                          return (
                            <button key={model.id} onClick={() => canEdit && toggleORModel(model.id)} disabled={!canEdit || (!isSel && selectedORModels.length >= 5)}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${isSel ? (tier === "Free" ? "border-emerald-500/50 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10") : "border-border bg-muted/20 hover:border-border/80 hover:bg-muted/30"} disabled:cursor-not-allowed disabled:opacity-50`}>
                              <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${isSel ? (tier === "Free" ? "border-emerald-500 bg-emerald-500" : "border-amber-500 bg-amber-500") : "border-muted-foreground/40"}`}>
                                {isSel && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0"><p className="text-[13px] text-foreground truncate">{model.name}</p><p className="text-[11px] text-muted-foreground capitalize">{model.provider}</p></div>
                              <TierBadge tier={tier} />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {selectedORModels.length > 0 && (
              <div className="rounded-xl border border-border bg-card/50 p-5">
                <h4 className="text-[13px] font-semibold text-foreground mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" />Active Chat Models</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <Cpu className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="text-[12px] text-foreground flex-1">{GEMINI_MODELS.find(m => m.id === selectedGeminiModel)?.name || selectedGeminiModel}</span>
                    <span className="text-[10px] text-amber-400">Gemini</span>
                  </div>
                  {selectedORModels.map(id => {
                    const model = [...orModels.free, ...orModels.pro].find(m => m.id === id)
                    return (
                      <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 border border-border">
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-[12px] text-foreground flex-1">{model?.name || id}</span>
                        <span className="text-[10px] text-muted-foreground">OpenRouter</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ══ Research – Search Providers ══ */}
            <SectionCard title="Research — Search Providers" icon={Search} locked={!canEdit} accent="blue">
              <p className="text-[12px] text-muted-foreground mb-5">
                Used by the <code className="text-blue-400">research</code> agent tool. Tried in order:
                <span className="text-blue-400 font-medium"> Tavily → Brave → SerpAPI</span>. Add at least one.
              </p>
              <div className="space-y-6">
                <ToolKeyRow label="Tavily API Key" placeholder="tvly-…" hasSaved={!!settings?.hasTavilyKey}
                  hint="Recommended primary. AI-optimised web search with snippet + content extraction."
                  value={tavilyKey} onChange={setTavilyKey}
                  onSave={async () => { setSavingTavily(true); try { await saveKey({ tavilyApiKey: tavilyKey }); setTavilyKey("") } finally { setSavingTavily(false) } }}
                  onTest={async () => testProvider("tavily", setTestTavily, tavilyKey || undefined)}
                  saving={savingTavily} testStatus={testTavily} disabled={!canEdit} docsUrl="https://docs.tavily.com" />
                <ToolKeyRow label="Brave Search API Key" placeholder="BSAb…" hasSaved={!!settings?.hasBraveKey}
                  hint="Fallback. Privacy-first search results."
                  value={braveKey} onChange={setBraveKey}
                  onSave={async () => { setSavingBrave(true); try { await saveKey({ braveApiKey: braveKey }); setBraveKey("") } finally { setSavingBrave(false) } }}
                  onTest={async () => testProvider("brave", setTestBrave, braveKey || undefined)}
                  saving={savingBrave} testStatus={testBrave} disabled={!canEdit} docsUrl="https://brave.com/search/api" />
                <ToolKeyRow label="SerpAPI Key" placeholder="your-serpapi-key" hasSaved={!!settings?.hasSerpApiKey}
                  hint="Final fallback. Google Search results via SerpAPI."
                  value={serpKey} onChange={setSerpKey}
                  onSave={async () => { setSavingSerp(true); try { await saveKey({ serpApiKey: serpKey }); setSerpKey("") } finally { setSavingSerp(false) } }}
                  onTest={async () => testProvider("serpapi", setTestSerp, serpKey || undefined)}
                  saving={savingSerp} testStatus={testSerp} disabled={!canEdit} docsUrl="https://serpapi.com/manage-api-key" />
              </div>
            </SectionCard>

            {/* ══ Research – Crawl Providers ══ */}
            <SectionCard title="Research — Crawl Providers" icon={Server} locked={!canEdit} accent="emerald">
              <p className="text-[12px] text-muted-foreground mb-5">
                Extracts full page content from search results. Order:
                <span className="text-emerald-400 font-medium"> Firecrawl → Crawl4AI → Basic Fetch</span>.
                Basic fetch is always available — no key needed.
              </p>
              <div className="space-y-6">
                <ToolKeyRow label="Firecrawl API Key" placeholder="fc-…" hasSaved={!!settings?.hasFirecrawlKey}
                  hint="Managed crawl service with JS rendering. Best quality extraction."
                  value={firecrawlKey} onChange={setFirecrawlKey}
                  onSave={async () => { setSavingFirecrawl(true); try { await saveKey({ firecrawlApiKey: firecrawlKey }); setFirecrawlKey("") } finally { setSavingFirecrawl(false) } }}
                  onTest={async () => testProvider("firecrawl", setTestFirecrawl, firecrawlKey || undefined)}
                  saving={savingFirecrawl} testStatus={testFirecrawl} disabled={!canEdit} docsUrl="https://docs.firecrawl.dev" />

                {/* Crawl4AI — URL input, not a secret */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <label className="text-[12px] font-semibold text-foreground">Crawl4AI Base URL</label>
                    {settings?.hasCrawl4aiUrl && <span className="text-[10px] text-emerald-400 font-medium border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.5 rounded-full">Saved ✓</span>}
                    <a href="https://github.com/unclecode/crawl4ai" target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"><Link2 className="w-3 h-3" />GitHub</a>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Self-hosted open-source crawler (fallback). Enter your instance URL.</p>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 focus-within:border-primary/40">
                    <Server className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <input type="text" value={crawl4aiUrl} onChange={e => setCrawl4aiUrl(e.target.value)} placeholder="https://your-crawl4ai.example.com" disabled={!canEdit} className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={async () => { setSavingCrawl4ai(true); try { await saveKey({ crawl4aiUrl: crawl4aiUrl || null }) } finally { setSavingCrawl4ai(false) } }}
                      disabled={!crawl4aiUrl.trim() || !canEdit || savingCrawl4ai}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      {savingCrawl4ai ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />} Save
                    </button>
                    <button onClick={async () => testProvider("crawl4ai", setTestCrawl4ai, undefined, crawl4aiUrl || undefined)} disabled={testCrawl4ai.type === "loading"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-[12px] text-foreground hover:bg-accent transition-colors disabled:opacity-50">
                      {testCrawl4ai.type === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Test
                    </button>
                    {testCrawl4ai.type && testCrawl4ai.type !== "loading" && (
                      <span className={`text-[12px] flex items-center gap-1 ${testCrawl4ai.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                        {testCrawl4ai.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}{testCrawl4ai.message}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* ══ Cloudinary ══ */}
            <SectionCard title="Cloudinary — Image CDN" icon={Image} locked={!canEdit} accent="purple">
              <p className="text-[12px] text-muted-foreground mb-5">
                Used by the agent to store generated images permanently. Requires
                <span className="text-purple-400 font-medium"> Cloud Name</span> +
                <span className="text-purple-400 font-medium"> Upload Preset</span> (unsigned) or
                <span className="text-purple-400 font-medium"> API Key</span> (signed).
              </p>

              {/* Cloud Name */}
              <div className="space-y-2.5 pb-5 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <label className="text-[12px] font-semibold text-foreground">Cloud Name</label>
                  {settings?.hasCloudinaryCloudName && <span className="text-[10px] text-emerald-400 font-medium border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.5 rounded-full">Saved ✓</span>}
                  <a href="https://cloudinary.com/documentation/cloudinary_get_started" target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"><Link2 className="w-3 h-3" />Docs</a>
                </div>
                <p className="text-[11px] text-muted-foreground">Found in your Cloudinary dashboard. Not a secret.</p>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 focus-within:border-primary/40">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <input type="text" value={cloudName} onChange={e => setCloudName(e.target.value)} placeholder="my-cloud-name" disabled={!canEdit} className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={async () => { setSavingCloud(true); try { await saveKey({ cloudinaryCloudName: cloudName || null }) } finally { setSavingCloud(false) } }}
                    disabled={!cloudName.trim() || !canEdit || savingCloud}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {savingCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />} Save
                  </button>
                  <button onClick={async () => testProvider("cloudinary", setTestCloud, cloudName || undefined)} disabled={testCloud.type === "loading"}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-[12px] text-foreground hover:bg-accent transition-colors disabled:opacity-50">
                    {testCloud.type === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Test
                  </button>
                  {testCloud.type && testCloud.type !== "loading" && (
                    <span className={`text-[12px] flex items-center gap-1 ${testCloud.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                      {testCloud.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}{testCloud.message}
                    </span>
                  )}
                </div>
              </div>

              {/* Upload Preset */}
              <ToolKeyRow label="Upload Preset" placeholder="ml_default" hasSaved={!!settings?.hasCloudinaryUploadPreset}
                hint="Create an unsigned preset in Cloudinary → Settings → Upload. Recommended."
                isPassword={false} value={cloudPreset} onChange={setCloudPreset}
                onSave={async () => { setSavingCloud(true); try { await saveKey({ cloudinaryUploadPreset: cloudPreset || null }); setCloudPreset("") } finally { setSavingCloud(false) } }}
                onTest={async () => setTestCloud(cloudPreset || settings?.hasCloudinaryUploadPreset ? { type: "success", message: "Upload preset configured ✓" } : { type: "error", message: "No preset saved" })}
                saving={savingCloud} testStatus={{ type: null, message: "" }} disabled={!canEdit} docsUrl="https://cloudinary.com/documentation/upload_presets" />

              {/* API Key */}
              <ToolKeyRow label="API Key (optional — signed uploads)" placeholder="123456789012345" hasSaved={!!settings?.hasCloudinaryApiKey}
                hint="Only needed for signed uploads. Skip if using an unsigned preset above."
                value={cloudApiKey} onChange={setCloudApiKey}
                onSave={async () => { setSavingCloud(true); try { await saveKey({ cloudinaryApiKey: cloudApiKey || null }); setCloudApiKey("") } finally { setSavingCloud(false) } }}
                onTest={async () => setTestCloud(cloudApiKey || settings?.hasCloudinaryApiKey ? { type: "success", message: "API key configured ✓" } : { type: "error", message: "No API key saved" })}
                saving={savingCloud} testStatus={{ type: null, message: "" }} disabled={!canEdit} docsUrl="https://cloudinary.com/documentation/upload_images#generating_authentication_signatures" />

              {/* Status summary */}
              <div className="mt-4 p-3 rounded-lg bg-muted/20 border border-border">
                <p className="text-[12px] font-medium text-foreground mb-2">Configuration Status</p>
                <div className="space-y-1.5">
                  {[
                    { label: "Cloud Name",    ok: !!settings?.hasCloudinaryCloudName },
                    { label: "Upload Preset", ok: !!settings?.hasCloudinaryUploadPreset },
                    { label: "API Key",       ok: !!settings?.hasCloudinaryApiKey, optional: true },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      {item.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40" />}
                      <span className={`text-[12px] ${item.ok ? "text-foreground" : "text-muted-foreground"}`}>{item.label}</span>
                      {item.optional && !item.ok && <span className="text-[10px] text-muted-foreground">(optional)</span>}
                    </div>
                  ))}
                </div>
                {settings?.hasCloudinaryCloudName && settings?.hasCloudinaryUploadPreset && (
                  <p className="mt-2 text-[11px] text-emerald-400">✓ Cloudinary fully configured. Agent can upload images.</p>
                )}
              </div>
            </SectionCard>
          </>
        )}

        {/* ══════ AGENT FILES TAB ══════ */}
        {activeTab === "agent-files" && (
          <>
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-purple-500/20 bg-purple-500/5 text-[13px]">
              <FileCode2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-purple-300 font-medium">Agent Configuration Files</p>
                <p className="text-muted-foreground text-[12px] mt-0.5">
                  Control agent behavior through markdown files. Active files are injected into the system prompt on every request.
                  <span className="text-purple-400 ml-1">System</span> sets the core prompt ·
                  <span className="text-amber-400 ml-1">Rules</span> add constraints ·
                  <span className="text-blue-400 ml-1">Tools</span> configure tool behavior.
                </p>
              </div>
            </div>
            {!canEdit && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-[13px]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>You need <strong>Admin</strong> or <strong>Super Admin</strong> role to manage agent files.</span>
              </div>
            )}
            <div className="h-[680px]">
              <AgentFilesPanel />
            </div>
          </>
        )}

      </div>
    </div>
  )
}
