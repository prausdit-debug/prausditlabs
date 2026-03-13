"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Send, User, Loader2, Trash2, ChevronDown, Code,
  FileText, Zap, X, Cpu, Globe, ChevronUp,
  Search, Wrench, CheckCircle2, BrainCircuit, Plus,
  MessageSquare, Lock, Users, MoreHorizontal, Pencil, Eye,
  EyeOff, ArrowLeft,
} from "lucide-react"
import { DocContent } from "@/components/docs/doc-content"
import { useCurrentUser } from "@/components/auth/auth-guard"

type AgentEventType = "text" | "status" | "tool_call" | "tool_result" | "done" | "error"

interface AgentEvent {
  type: AgentEventType
  text?: string
  tool?: string
  args?: Record<string, unknown>
  result?: unknown
  step?: number
}

interface AgentStep {
  id: string
  type: "status" | "tool_call" | "tool_result"
  text: string
  tool?: string
  args?: Record<string, unknown>
  result?: unknown
  step?: number
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  loading?: boolean
  agentSteps?: AgentStep[]
  stepsExpanded?: boolean
}

interface ChatModel {
  id: string
  name: string
  provider: "gemini" | "openrouter"
  shortName: string
}

interface ChatSession {
  id: string
  title: string
  creatorId: string
  creatorName?: string
  visibility: "team" | "private"
  createdAt: string
  updatedAt: string
  _count?: { messages: number }
}

const SLASH_COMMANDS = [
  { cmd: "/document", desc: "Create a documentation page" },
  { cmd: "/roadmap",  desc: "Add a roadmap step" },
  { cmd: "/experiment", desc: "Design an experiment" },
  { cmd: "/dataset",  desc: "Register a dataset" },
  { cmd: "/note",     desc: "Save a research note" },
]

const GEMINI_MODELS: ChatModel[] = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini", shortName: "2.5 Flash" },
  { id: "gemini-2.5-pro",   name: "Gemini 2.5 Pro",   provider: "gemini", shortName: "2.5 Pro"   },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "gemini", shortName: "1.5 Flash" },
]

const TOOL_ICONS: Record<string, React.ElementType> = {
  search_internal_docs: Search,
  read_document: FileText,
  create_document: FileText,
  update_document: FileText,
  create_note: FileText,
  create_roadmap_step: Zap,
  update_roadmap_step: Zap,
  create_experiment: Code,
  update_experiment: Code,
  create_dataset: Cpu,
  update_dataset: Cpu,
  crawl_web: Globe,
}

function ModelBadge({ provider }: { provider: "gemini" | "openrouter" }) {
  return provider === "gemini"
    ? <Cpu className="w-3 h-3 text-amber-400" />
    : <Globe className="w-3 h-3 text-blue-400" />
}

function AgentStepItem({ step }: { step: AgentStep }) {
  const Icon = step.tool ? (TOOL_ICONS[step.tool] || Wrench) : BrainCircuit
  return (
    <div className={cn("flex items-start gap-2 py-1.5 text-[11px]", step.type === "tool_result" ? "text-emerald-400/80" : "text-muted-foreground")}>
      <div className="w-4 h-4 flex-shrink-0 mt-0.5 flex items-center justify-center">
        {step.type === "tool_result" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Icon className="w-3.5 h-3.5" />}
      </div>
      <span className="leading-relaxed">{step.text}</span>
    </div>
  )
}

function AgentStepsPanel({ steps, expanded, onToggle }: { steps: AgentStep[]; expanded: boolean; onToggle: () => void }) {
  if (steps.length === 0) return null
  return (
    <div className="mt-2 rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 transition-colors text-left">
        <BrainCircuit className="w-3 h-3 text-amber-400/70 flex-shrink-0" />
        <span className="text-[10px] text-muted-foreground font-medium flex-1">{steps.length} agent step{steps.length !== 1 ? "s" : ""}</span>
        {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </button>
      {expanded && <div className="px-3 pb-2 border-t border-border/30">{steps.map(s => <AgentStepItem key={s.id} step={s} />)}</div>}
    </div>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function FullscreenChatPage() {
  const router = useRouter()
  const appUser = useCurrentUser()
  const currentUserId = appUser?.clerkId || ""
  const userRole = appUser?.role || "user"

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [showCommands, setShowCommands] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [availableModels, setAvailableModels] = useState<ChatModel[]>(GEMINI_MODELS)
  const [selectedModel, setSelectedModel] = useState<ChatModel>(GEMINI_MODELS[0])
  const [currentStatus, setCurrentStatus] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState("")
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const finalAMsgRef = useRef<Message | null>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, currentStatus])

  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(async s => {
      if (!s) return
      const ids: string[] = s.selectedOpenRouterModels || []
      let orModels: ChatModel[] = []
      if (ids.length > 0) {
        try {
          const res = await fetch("/api/openrouter-models")
          const data = res.ok ? await res.json() : {}
          const all: Array<{ id: string; name: string }> = [...(data.free || []), ...(data.pro || [])]
          orModels = ids.map(id => {
            const found = all.find(m => m.id === id)
            return { id, name: found?.name || id, provider: "openrouter" as const, shortName: (found?.name || id).split("/").pop()?.slice(0, 18) || id }
          })
        } catch { /* ignore */ }
      }
      const all = [...GEMINI_MODELS, ...orModels]
      setAvailableModels(all)
      const defProvider = s.defaultProvider || "gemini"
      const defGemini = s.geminiDefaultModel || "gemini-2.5-flash"
      if (defProvider === "openrouter" && orModels.length > 0) setSelectedModel(orModels[0])
      else setSelectedModel(all.find(m => m.id === defGemini) || GEMINI_MODELS[0])
    }).catch(() => {})

    loadSessions()
  }, [])

  useEffect(() => {
    setShowCommands(input.startsWith("/") && !input.includes(" "))
  }, [input])

  useEffect(() => {
    function h(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (!t.closest("[data-session-menu]")) setMenuOpen(null)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const res = await fetch("/api/chat-sessions")
      const data = res.ok ? await res.json() : { sessions: [] }
      const list: ChatSession[] = data.sessions || []
      setSessions(list)
      if (list.length > 0 && !activeSessionId) {
        setActiveSessionId(list[0].id)
        loadSessionMessages(list[0].id)
      }
    } catch { /* ignore */ }
    setSessionsLoading(false)
  }, [activeSessionId])

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/chat-sessions/${sessionId}/messages`)
      const data = res.ok ? await res.json() : { messages: [] }
      const msgs: Message[] = (data.messages || []).map((m: { id: string; role: string; content: string; metadata?: { agentSteps?: AgentStep[] } }) => ({
        id: m.id, role: m.role as "user" | "assistant", content: m.content,
        agentSteps: m.metadata?.agentSteps || [], stepsExpanded: false,
      }))
      setMessages(msgs)
    } catch { setMessages([]) }
  }, [])

  const createSession = useCallback(async () => {
    try {
      const res = await fetch("/api/chat-sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat", visibility: "team" }),
      })
      if (!res.ok) return null
      const session: ChatSession = await res.json()
      setSessions(prev => [session, ...prev])
      setActiveSessionId(session.id)
      setMessages([])
      setMobileSidebarOpen(false)
      return session.id
    } catch { return null }
  }, [])

  const selectSession = useCallback((id: string) => {
    if (id === activeSessionId) return
    setActiveSessionId(id)
    setMessages([])
    loadSessionMessages(id)
    setMobileSidebarOpen(false)
  }, [activeSessionId, loadSessionMessages])

  const renameSession = useCallback(async (id: string, title: string) => {
    await fetch(`/api/chat-sessions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) }).catch(() => {})
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s))
  }, [])

  const deleteSession = useCallback(async (id: string) => {
    await fetch(`/api/chat-sessions/${id}`, { method: "DELETE" }).catch(() => {})
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id)
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id)
        loadSessionMessages(remaining[0].id)
      } else {
        setActiveSessionId(null)
        setMessages([])
      }
    }
  }, [activeSessionId, sessions, loadSessionMessages])

  const changeVisibility = useCallback(async (id: string, vis: "team" | "private") => {
    await fetch(`/api/chat-sessions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility: vis }) }).catch(() => {})
    setSessions(prev => prev.map(s => s.id === id ? { ...s, visibility: vis } : s))
  }, [])

  const toggleSteps = useCallback((msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, stepsExpanded: !m.stepsExpanded } : m))
  }, [])

  const canManage = (s: ChatSession) =>
    s.creatorId === currentUserId || userRole === "super_admin" || userRole === "admin"

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

    let sessionId = activeSessionId
    if (!sessionId) {
      sessionId = await createSession()
      if (!sessionId) return
    }

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() }
    const aMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "", loading: true, agentSteps: [], stepsExpanded: false }
    finalAMsgRef.current = aMsg

    setMessages(prev => [...prev, userMsg, aMsg])
    setInput("")
    setIsStreaming(true)
    setCurrentStatus("Agent thinking...")
    abortRef.current = new AbortController()

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch("/api/agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), history, provider: selectedModel.provider, model: selectedModel.id }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) { const err = await res.json().catch(() => ({ error: "API error" })); throw new Error(err.error || `HTTP ${res.status}`) }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No stream body")

      let accumulated = "", buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += new TextDecoder().decode(value)
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const event = JSON.parse(raw) as AgentEvent
            if (event.type === "text" && event.text) {
              accumulated += event.text
              setMessages(prev => prev.map(m => { if (m.id === aMsg.id) { finalAMsgRef.current = { ...m, content: accumulated, loading: false }; return finalAMsgRef.current } return m }))
            }
            if (event.type === "status" && event.text) setCurrentStatus(event.text)
            if (event.type === "tool_call" && event.text) {
              setCurrentStatus(event.text)
              const step: AgentStep = { id: `tc-${Date.now()}`, type: "tool_call", text: event.text, tool: event.tool, args: event.args, step: event.step }
              setMessages(prev => prev.map(m => { if (m.id === aMsg.id) { finalAMsgRef.current = { ...m, loading: false, agentSteps: [...(m.agentSteps || []), step] }; return finalAMsgRef.current } return m }))
            }
            if (event.type === "tool_result" && event.text) {
              setCurrentStatus(null)
              const step: AgentStep = { id: `tr-${Date.now()}`, type: "tool_result", text: event.text, tool: event.tool, result: event.result, step: event.step }
              setMessages(prev => prev.map(m => { if (m.id === aMsg.id) { finalAMsgRef.current = { ...m, agentSteps: [...(m.agentSteps || []), step] }; return finalAMsgRef.current } return m }))
            }
            if (event.type === "error") { const ec = `Error: ${event.text || "Unknown error"}`; setMessages(prev => prev.map(m => m.id === aMsg.id ? { ...m, content: ec, loading: false } : m)) }
            if (event.type === "done") { setCurrentStatus(null); setMessages(prev => prev.map(m => m.id === aMsg.id ? { ...m, loading: false } : m)) }
          } catch { /* ignore */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      const msg = err instanceof Error ? err.message : "Unknown error"
      setMessages(prev => prev.map(m => m.id === aMsg.id ? { ...m, content: `Error: ${msg}`, loading: false } : m))
    } finally {
      setIsStreaming(false)
      setCurrentStatus(null)
      abortRef.current = null
      // Persist to session
      if (sessionId && finalAMsgRef.current) {
        const finalMsg = finalAMsgRef.current
        fetch(`/api/chat-sessions/${sessionId}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: userMsg.role, content: userMsg.content }, { role: finalMsg.role, content: finalMsg.content, metadata: { agentSteps: finalMsg.agentSteps || [] } }] }),
        }).catch(() => {})
        // Auto-title
        setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            const newTitle = s.title === "New Chat" ? text.trim().slice(0, 50) : s.title
            return { ...s, title: newTitle, updatedAt: new Date().toISOString() }
          }
          return s
        }))
        const foundSession = sessions.find(s => s.id === sessionId)
        if (foundSession?.title === "New Chat") {
          fetch(`/api/chat-sessions/${sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: text.trim().slice(0, 50) }) }).catch(() => {})
        }
      }
    }
  }, [messages, isStreaming, selectedModel, activeSessionId, createSession, sessions])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
    if (e.key === "Escape") { setShowCommands(false); setShowModelPicker(false) }
  }

  const stopStreaming = () => { abortRef.current?.abort(); setIsStreaming(false); setCurrentStatus(null) }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex overflow-hidden -m-4 md:-m-6">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "lg:relative lg:translate-x-0 fixed inset-y-0 left-0 z-50 w-72 flex-shrink-0 border-r border-border bg-card flex flex-col h-full transition-transform duration-200",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/")} className="p-1.5 rounded-md hover:bg-accent transition-colors" title="Back to dashboard">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-[13px] font-semibold text-foreground">Chat Sessions</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={createSession} className="w-7 h-7 rounded-md flex items-center justify-center bg-amber-500 hover:bg-amber-400 transition-colors" title="New session">
              <Plus className="w-4 h-4 text-black" />
            </button>
            <button onClick={() => setMobileSidebarOpen(false)} className="lg:hidden p-1.5 rounded-md hover:bg-accent transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto py-2">
          {sessionsLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!sessionsLoading && sessions.length === 0 && (
            <div className="text-center py-8 px-4">
              <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-[12px] text-muted-foreground">No sessions yet</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">Click + to start a new chat</p>
            </div>
          )}
          {sessions.map(s => (
            <div key={s.id}
              className={cn("group relative flex items-start gap-2 px-3 py-3 mx-2 rounded-lg cursor-pointer transition-all",
                activeSessionId === s.id ? "bg-amber-500/10 border border-amber-500/20" : "hover:bg-muted/50")}
              onClick={() => selectSession(s.id)}
            >
              <MessageSquare className={cn("w-4 h-4 flex-shrink-0 mt-0.5", activeSessionId === s.id ? "text-amber-400" : "text-muted-foreground")} />
              <div className="flex-1 min-w-0 pr-1">
                {renaming === s.id ? (
                  <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                    onBlur={() => { if (renameVal.trim()) renameSession(s.id, renameVal.trim()); setRenaming(null) }}
                    onKeyDown={e => { if (e.key === "Enter") { if (renameVal.trim()) renameSession(s.id, renameVal.trim()); setRenaming(null) } if (e.key === "Escape") setRenaming(null) }}
                    onClick={e => e.stopPropagation()}
                    className="w-full bg-background border border-amber-500/40 rounded px-2 py-1 text-[13px] text-foreground outline-none"
                  />
                ) : (
                  <p className={cn("text-[13px] font-medium truncate leading-tight", activeSessionId === s.id ? "text-foreground" : "text-foreground/80")}>{s.title}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  {s.visibility === "private" ? <Lock className="w-3 h-3 text-muted-foreground/60" /> : <Users className="w-3 h-3 text-muted-foreground/60" />}
                  <span className="text-[11px] text-muted-foreground/60">{timeAgo(s.updatedAt)}</span>
                  {s._count && <span className="text-[11px] text-muted-foreground/50">- {s._count.messages} msgs</span>}
                </div>
              </div>
              {canManage(s) && (
                <div data-session-menu className="relative flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === s.id ? null : s.id) }}
                    className={cn("p-1.5 rounded-md transition-colors", menuOpen === s.id ? "text-foreground bg-accent" : "text-transparent group-hover:text-muted-foreground hover:bg-accent")}>
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {menuOpen === s.id && (
                    <div className="absolute right-0 top-8 z-50 w-48 rounded-lg border border-border bg-card shadow-xl py-1">
                      <button onClick={e => { e.stopPropagation(); setRenameVal(s.title); setRenaming(s.id); setMenuOpen(null) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-accent transition-colors text-left">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Rename
                      </button>
                      <button onClick={e => { e.stopPropagation(); changeVisibility(s.id, s.visibility === "team" ? "private" : "team"); setMenuOpen(null) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-accent transition-colors text-left">
                        {s.visibility === "team" ? <><EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> Make Private</> : <><Eye className="w-3.5 h-3.5 text-muted-foreground" /> Make Team</>}
                      </button>
                      <div className="border-t border-border my-1" />
                      <button onClick={e => { e.stopPropagation(); deleteSession(s.id); setMenuOpen(null) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-red-500/10 text-red-400 transition-colors text-left">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
          <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden p-1.5 rounded-md hover:bg-accent transition-colors">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <BrainCircuit className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-foreground truncate">
              {activeSessionId ? sessions.find(s => s.id === activeSessionId)?.title || "Chat" : "Prausdit Lab Agent"}
            </p>
            <div className="flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", isStreaming ? "bg-amber-400 animate-pulse" : "bg-emerald-500")} />
              <ModelBadge provider={selectedModel.provider} />
              <span className="text-[11px] text-muted-foreground">{selectedModel.shortName} - Agentic</span>
              {isStreaming && <span className="text-[10px] text-amber-400 font-mono animate-pulse">RUNNING</span>}
            </div>
          </div>
          {activeSessionId && (
            <div className="flex items-center gap-1">
              {sessions.find(s => s.id === activeSessionId)?.visibility === "private"
                ? <Lock className="w-4 h-4 text-muted-foreground/60" />
                : <Users className="w-4 h-4 text-muted-foreground/60" />}
            </div>
          )}
        </div>

        {/* Messages area */}
        {!activeSessionId && !sessionsLoading ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <BrainCircuit className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-[17px] font-bold text-foreground mb-2">Prausdit Lab Agent</h2>
              <p className="text-[13px] text-muted-foreground mb-6">Autonomous AI assistant for research workflows. Search, create, and automate.</p>
              <button onClick={createSession}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[13px] font-medium transition-colors mx-auto">
                <Plus className="w-4 h-4" /> Start New Chat
              </button>
            </div>
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {messages.length === 0 && !sessionsLoading && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
                  <BrainCircuit className="w-6 h-6 text-amber-400" />
                </div>
                <p className="text-[14px] font-semibold text-foreground">Start the conversation</p>
                <p className="text-[12px] text-muted-foreground mt-1 mb-4">Ask questions, use /commands to create content</p>
                <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                  {[{ icon: Search, label: "Search KB" }, { icon: Globe, label: "Web research" }, { icon: FileText, label: "Create docs" }, { icon: Zap, label: "Plan tasks" }].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border">
                      <Icon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-1">
                    <BrainCircuit className="w-4 h-4 text-amber-400" />
                  </div>
                )}
                <div className={cn("max-w-[80%] rounded-xl px-4 py-3 text-[14px]",
                  msg.role === "user" ? "bg-amber-500 text-black rounded-br-sm" : "bg-muted border border-border rounded-bl-sm")}>
                  {msg.loading && !msg.content && !msg.agentSteps?.length ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      <span className="text-muted-foreground text-[13px]">{currentStatus || "Agent thinking..."}</span>
                    </div>
                  ) : (
                    <>
                      {msg.loading && !msg.content && !!msg.agentSteps?.length && currentStatus && (
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 flex-shrink-0" />
                          <span className="text-[12px] text-amber-400">{currentStatus}</span>
                        </div>
                      )}
                      {msg.content && (
                        msg.role === "assistant"
                          ? <div className="prose-dark text-[14px]"><DocContent content={msg.content} /></div>
                          : <span className="leading-relaxed">{msg.content}</span>
                      )}
                      {msg.role === "assistant" && !!msg.agentSteps?.length && (
                        <AgentStepsPanel steps={msg.agentSteps} expanded={msg.stepsExpanded ?? false} onToggle={() => toggleSteps(msg.id)} />
                      )}
                    </>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-zinc-300" />
                  </div>
                )}
              </div>
            ))}
            {isStreaming && currentStatus && (
              <div className="flex items-center gap-2 pl-11">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span className="text-[12px] text-amber-400">{currentStatus}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input area */}
        {activeSessionId && (
          <div className="border-t border-border p-4 flex-shrink-0 bg-card/50">
            {showCommands && (
              <div className="mb-2 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                {SLASH_COMMANDS.filter(c => c.cmd.includes(input)).map(c => (
                  <button key={c.cmd} onClick={() => { setInput(c.cmd + " "); setShowCommands(false); inputRef.current?.focus() }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-left">
                    <code className="text-[12px] text-amber-400 font-mono">{c.cmd}</code>
                    <span className="text-[12px] text-muted-foreground">{c.desc}</span>
                  </button>
                ))}
              </div>
            )}
            {showModelPicker && (
              <div className="mb-2 rounded-lg border border-border bg-card shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Select Model</p>
                </div>
                {availableModels.map(model => (
                  <button key={model.id} onClick={() => { setSelectedModel(model); setShowModelPicker(false); inputRef.current?.focus() }}
                    className={cn("w-full flex items-center gap-2 px-4 py-2.5 hover:bg-accent transition-colors text-left", selectedModel.id === model.id && "bg-amber-500/5")}>
                    <ModelBadge provider={model.provider} />
                    <span className="text-[13px] text-foreground flex-1 truncate">{model.name}</span>
                    {selectedModel.id === model.id && <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setShowModelPicker(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-accent transition-colors">
                <ModelBadge provider={selectedModel.provider} />
                <span className="text-[12px] text-foreground font-medium max-w-[140px] truncate">{selectedModel.shortName}</span>
                {showModelPicker ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[11px] text-muted-foreground">Agentic - {selectedModel.provider === "gemini" ? "Gemini" : "OpenRouter"}</span>
              </div>
              {isStreaming && (
                <button onClick={stopStreaming} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] hover:bg-red-500/20 transition-colors">
                  <X className="w-3.5 h-3.5" /> Stop
                </button>
              )}
            </div>
            <div className="flex items-end gap-3 bg-muted rounded-xl px-4 py-3 border border-border focus-within:border-amber-500/40">
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Ask a question, use /command to create, or @docs to reference..."
                rows={1}
                className="flex-1 bg-transparent text-foreground text-[14px] outline-none resize-none placeholder:text-muted-foreground min-h-[24px] max-h-[120px]" />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || isStreaming}
                className={cn("p-2 rounded-lg transition-all flex-shrink-0", input.trim() && !isStreaming ? "bg-amber-500 text-black hover:bg-amber-400" : "text-muted-foreground")}>
                {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
