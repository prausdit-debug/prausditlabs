"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useId, useEffect } from "react"
import { cn } from "@/lib/utils"
import { UserButton } from "@clerk/nextjs"
import { useCurrentUser } from "@/components/auth/auth-guard"
import { useProject, ProjectType } from "@/components/project/project-context"
import {
  LayoutDashboard, Map, BookOpen, Database, FlaskConical,
  Package, StickyNote, ChevronRight, Users,
  Menu, X, Settings, Shield, MessageSquare, FolderKanban,
  ChevronDown, Plus, Cpu, Globe, Server, Sparkles, Check,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Overview", href: "/", icon: LayoutDashboard, minRole: "developer" },
  { label: "AI Chat", href: "/chat", icon: MessageSquare, minRole: "developer" },
  { label: "Roadmap", href: "/roadmap", icon: Map, minRole: "developer" },
  { label: "Documentation", href: "/docs", icon: BookOpen, minRole: "developer" },
  { label: "Datasets", href: "/datasets", icon: Database, minRole: "developer" },
  { label: "Experiments", href: "/experiments", icon: FlaskConical, minRole: "developer" },
  { label: "Model Versions", href: "/models", icon: Package, minRole: "developer" },
  { label: "Notes", href: "/notes", icon: StickyNote, minRole: "developer" },
]

const ADMIN_ITEMS = [
  { label: "Users", href: "/users", icon: Users, minRole: "admin" },
  { label: "Settings", href: "/settings", icon: Settings, minRole: "admin" },
]

const ROLE_RANK: Record<string, number> = {
  user: 0, developer: 1, admin: 2, super_admin: 3,
}

function hasAccess(userRole: string, minRole: string) {
  return (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[minRole] ?? 0)
}

// Project type icons
const PROJECT_TYPE_ICONS: Record<ProjectType, React.ElementType> = {
  MODEL: Cpu,
  FRONTEND: Globe,
  BACKEND: Server,
  CUSTOM: Sparkles,
}

const PROJECT_TYPE_COLORS: Record<ProjectType, string> = {
  MODEL: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  FRONTEND: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  BACKEND: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  CUSTOM: "text-amber-400 bg-amber-500/10 border-amber-500/20",
}

function NavContent({ onLinkClick, onOpenProjectDialog }: { onLinkClick?: () => void; onOpenProjectDialog?: () => void }) {
  const pathname = usePathname()
  const appUser = useCurrentUser()
  const userRole = appUser?.role ?? "developer"
  const workspaceId = useId()
  const adminId = useId()
  
  const { projects, selectedProject, selectProject, loading: projectsLoading } = useProject()
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const canCreateProject = ["admin", "super_admin"].includes(userRole)

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div 
            className="w-7 h-7 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center"
            aria-hidden="true"
          >
            <FlaskConical className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground leading-none">Prausdit Research Lab</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">AI Agent Research Environment</p>
          </div>
        </div>
      </div>

      {/* Project Selector */}
      <div className="px-3 pt-3 relative">
        <button
          onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-2.5 rounded-lg border transition-colors text-left",
            selectedProject 
              ? PROJECT_TYPE_COLORS[selectedProject.type]
              : "bg-muted/30 border-border hover:bg-muted/50"
          )}
          aria-expanded={projectDropdownOpen}
          aria-haspopup="listbox"
        >
          {selectedProject ? (
            <>
              {(() => {
                const Icon = PROJECT_TYPE_ICONS[selectedProject.type]
                return <Icon className="w-4 h-4 flex-shrink-0" />
              })()}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate">{selectedProject.name}</p>
                <p className="text-[10px] opacity-70 capitalize">{selectedProject.type.toLowerCase()} Project</p>
              </div>
            </>
          ) : (
            <>
              <FolderKanban className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-[12px] text-muted-foreground flex-1">No Project Selected</span>
            </>
          )}
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform flex-shrink-0",
            projectDropdownOpen && "rotate-180"
          )} />
        </button>

        {/* Project Dropdown */}
        {projectDropdownOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setProjectDropdownOpen(false)} 
            />
            <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg border border-border bg-card shadow-xl overflow-hidden max-h-64 overflow-y-auto">
              {projectsLoading ? (
                <div className="px-3 py-4 text-center text-[12px] text-muted-foreground">
                  Loading projects...
                </div>
              ) : projects.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-[12px] text-muted-foreground mb-2">No projects yet</p>
                  {canCreateProject && (
                    <button
                      onClick={() => { setProjectDropdownOpen(false); onOpenProjectDialog?.() }}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-medium"
                    >
                      Create your first project
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Project list */}
                  {projects.map(project => {
                    const Icon = PROJECT_TYPE_ICONS[project.type]
                    const isSelected = selectedProject?.id === project.id
                    return (
                      <button
                        key={project.id}
                        onClick={() => { selectProject(project.id); setProjectDropdownOpen(false) }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent transition-colors",
                          isSelected && "bg-amber-500/5"
                        )}
                      >
                        <Icon className={cn("w-4 h-4 flex-shrink-0", PROJECT_TYPE_COLORS[project.type].split(" ")[0])} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-foreground truncate">{project.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{project.type.toLowerCase()}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                      </button>
                    )
                  })}
                  
                  {/* Add project button */}
                  {canCreateProject && (
                    <>
                      <div className="border-t border-border" />
                      <button
                        onClick={() => { setProjectDropdownOpen(false); onOpenProjectDialog?.() }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                      >
                        <Plus className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span className="text-[12px] text-amber-400 font-medium">New Project</span>
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Main navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        <p 
          id={workspaceId}
          className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2"
        >
          Workspace
        </p>
        <ul role="list" aria-labelledby={workspaceId} className="space-y-0.5">
          {NAV_ITEMS.filter(item => hasAccess(userRole, item.minRole)).map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onLinkClick}
                  className={cn(
                    "group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all",
                    isActive
                      ? "bg-amber-500/10 text-amber-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon 
                    className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-amber-400" : "text-muted-foreground group-hover:text-foreground")} 
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 text-amber-500/60 flex-shrink-0" aria-hidden="true" />}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Admin section — only for admin/super_admin */}
        {hasAccess(userRole, "admin") && (
          <>
            <p 
              id={adminId}
              className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mt-4 mb-2 flex items-center gap-1"
            >
              <Shield className="w-3 h-3" aria-hidden="true" /> Admin
            </p>
            <ul role="list" aria-labelledby={adminId} className="space-y-0.5">
              {ADMIN_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onLinkClick}
                      className={cn(
                        "group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all",
                        isActive
                          ? "bg-amber-500/10 text-amber-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon 
                        className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-amber-400" : "text-muted-foreground group-hover:text-foreground")} 
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {isActive && <ChevronRight className="w-3 h-3 text-amber-500/60 flex-shrink-0" aria-hidden="true" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </nav>

      {/* Footer — role badge + clerk user button */}
      <div className="px-3 pb-4 border-t border-border pt-3 flex-shrink-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
          Account
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8">
            <UserButton
              appearance={{ elements: { avatarBox: "w-7 h-7", userButtonAvatarBox: "w-7 h-7" } }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-foreground font-medium truncate">{appUser?.name ?? "Prausdit"}</p>
            <p className="text-[11px] text-muted-foreground font-mono">{userRole}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SidebarProps {
  onOpenProjectDialog?: () => void
}

export function Sidebar({ onOpenProjectDialog }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false)
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [mobileOpen])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileOpen])

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-30 w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-accent transition-colors shadow-sm active:scale-95"
        aria-label="Open navigation menu"
        aria-expanded={mobileOpen}
        aria-controls="mobile-sidebar"
      >
        <Menu className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in" 
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <aside 
        id="mobile-sidebar"
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-card border-r border-border transform transition-transform duration-300 ease-out shadow-2xl",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Mobile navigation"
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Close navigation menu"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
        <NavContent onLinkClick={() => setMobileOpen(false)} onOpenProjectDialog={onOpenProjectDialog} />
      </aside>

      {/* Desktop sidebar */}
      <aside 
        className="hidden md:flex w-60 flex-shrink-0 border-r border-border flex-col bg-card/50 backdrop-blur-sm"
        aria-label="Desktop navigation"
      >
        <NavContent onOpenProjectDialog={onOpenProjectDialog} />
      </aside>
    </>
  )
}
