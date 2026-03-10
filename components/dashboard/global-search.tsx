"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, BookOpen, Database, FlaskConical, Map, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchResult {
  id: string
  title: string
  type: "doc" | "dataset" | "experiment" | "roadmap"
  href: string
  excerpt?: string
}

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const router = useRouter()

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.results || [])
      setSelected(0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 200)
    return () => clearTimeout(t)
  }, [query, search])

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]) }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        if (open) onClose(); else {/* handled by parent */}
      }
      if (!open) return
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowDown") setSelected(s => Math.min(s + 1, results.length - 1))
      if (e.key === "ArrowUp") setSelected(s => Math.max(s - 1, 0))
      if (e.key === "Enter" && results[selected]) {
        router.push(results[selected].href)
        onClose()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, results, selected, router, onClose])

  if (!open) return null

  const typeIcons = {
    doc: BookOpen,
    dataset: Database,
    experiment: FlaskConical,
    roadmap: Map,
  }
  const typeColors = {
    doc: "text-violet-400",
    dataset: "text-blue-400",
    experiment: "text-amber-400",
    roadmap: "text-emerald-400",
  }
  const typeLabels = {
    doc: "Doc",
    dataset: "Dataset",
    experiment: "Experiment",
    roadmap: "Roadmap",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search documentation, experiments, datasets…"
            className="flex-1 bg-transparent text-foreground text-[14px] outline-none placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {results.length > 0 ? (
            <div className="p-2">
              {results.map((result, i) => {
                const Icon = typeIcons[result.type]
                const colorClass = typeColors[result.type]
                return (
                  <button
                    key={result.id}
                    onClick={() => { router.push(result.href); onClose() }}
                    className={cn(
                      "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      i === selected ? "bg-amber-500/10" : "hover:bg-accent"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", colorClass)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground truncate">{result.title}</span>
                        <span className={cn("text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border flex-shrink-0",
                          colorClass, "bg-current/10 border-current/20"
                        )}>
                          {typeLabels[result.type]}
                        </span>
                      </div>
                      {result.excerpt && (
                        <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{result.excerpt}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : query && !loading ? (
            <div className="py-10 text-center text-muted-foreground text-[13px]">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground text-[13px]">
              Type to search across all content
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><kbd className="font-mono bg-muted px-1 rounded">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="font-mono bg-muted px-1 rounded">↵</kbd> open</span>
          <span className="flex items-center gap-1"><kbd className="font-mono bg-muted px-1 rounded">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
