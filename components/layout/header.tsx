"use client"

import { useState } from "react"
import { Search, Bell, Command } from "lucide-react"
import { GlobalSearch } from "@/components/dashboard/global-search"

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <>
      <header className="h-14 border-b border-border flex items-center px-6 gap-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted border border-border text-muted-foreground text-[13px] hover:border-amber-500/30 hover:text-foreground transition-colors flex-1 max-w-sm"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search docs, experiments, datasets…</span>
          <div className="ml-auto flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[11px] bg-background border border-border rounded font-mono">⌘</kbd>
            <kbd className="px-1.5 py-0.5 text-[11px] bg-background border border-border rounded font-mono">K</kbd>
          </div>
        </button>

        <div className="ml-auto flex items-center gap-2">
          {/* Model status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5">
            <span className="status-dot completed" />
            <span className="text-[12px] text-emerald-400 font-mono">v0.2 deployed</span>
          </div>

          <button className="w-8 h-8 rounded-md border border-border bg-muted hover:bg-accent flex items-center justify-center transition-colors">
            <Bell className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
