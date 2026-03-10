"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Map,
  BookOpen,
  Database,
  FlaskConical,
  Package,
  StickyNote,
  Cpu,
  ChevronRight,
  Activity,
  Zap,
} from "lucide-react"

const navItems = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Roadmap",
    href: "/roadmap",
    icon: Map,
  },
  {
    label: "Documentation",
    href: "/docs",
    icon: BookOpen,
  },
  {
    label: "Datasets",
    href: "/datasets",
    icon: Database,
  },
  {
    label: "Experiments",
    href: "/experiments",
    icon: FlaskConical,
  },
  {
    label: "Model Versions",
    href: "/models",
    icon: Package,
  },
  {
    label: "Notes",
    href: "/notes",
    icon: StickyNote,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 flex-shrink-0 border-r border-border flex flex-col bg-card/50 backdrop-blur-sm">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground leading-none">PyCode-SLM</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Research Platform</p>
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-amber-500/5 border border-amber-500/15">
          <Activity className="w-3 h-3 text-amber-400" />
          <span className="text-[11px] text-amber-400 font-mono">PHASE 3 · IN PROGRESS</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
          Workspace
        </p>
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all",
                isActive
                  ? "bg-amber-500/10 text-amber-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className={cn(
                "w-4 h-4 flex-shrink-0",
                isActive ? "text-amber-400" : "text-muted-foreground group-hover:text-foreground"
              )} />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-3 h-3 text-amber-500/60" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t border-border pt-3">
        <div className="flex items-center gap-2 px-2">
          <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] text-foreground font-medium truncate">Research Lab</p>
            <p className="text-[11px] text-muted-foreground">v0.1.0-alpha</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
