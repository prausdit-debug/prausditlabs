"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProjectType = "MODEL" | "FRONTEND" | "BACKEND" | "CUSTOM"

export interface ProjectConfig {
  // Model project fields
  modelType?: "LLM" | "SLM" | "other"
  modelId?: string
  
  // Frontend project fields
  targetPlatform?: string[]
  frameworks?: string[]
  languages?: string[]
  
  // Backend project fields
  environment?: string[]
  backendFrameworks?: string[]
  backendLanguages?: string[]
  ramRequirements?: string
  computeRequirements?: string
  
  // Custom project fields
  customStructure?: string
}

export interface Project {
  id: string
  name: string
  type: ProjectType
  description?: string | null
  config?: ProjectConfig | null
  createdById: string
  createdBy?: {
    id: string
    name?: string | null
    email: string
  }
  createdAt: string
  updatedAt: string
  _count?: {
    datasets: number
    experiments: number
    documentation: number
    roadmapSteps: number
    notes: number
    modelVersions: number
    chatSessions: number
  }
}

interface ProjectContextType {
  projects: Project[]
  selectedProject: Project | null
  loading: boolean
  error: string | null
  selectProject: (projectId: string | null) => void
  refreshProjects: () => Promise<void>
  createProject: (data: Partial<Project>) => Promise<Project | null>
  updateProject: (id: string, data: Partial<Project>) => Promise<Project | null>
  deleteProject: (id: string) => Promise<boolean>
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

// ─── Provider ────────────────────────────────────────────────────────────────

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load projects on mount
  const refreshProjects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/projects")
      if (!res.ok) throw new Error("Failed to fetch projects")
      const data = await res.json()
      setProjects(data)
      
      // Restore selected project from localStorage
      // Note: useCallback runs client-side only — no SSR guard needed
      const savedProjectId = localStorage.getItem("selectedProjectId")
      if (savedProjectId) {
        const found = data.find((p: Project) => p.id === savedProjectId)
        if (found) setSelectedProject(found)
      }
    } catch (err) {
      console.error("Failed to load projects:", err)
      setError(err instanceof Error ? err.message : "Failed to load projects")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshProjects()
  }, [refreshProjects])

  // Select a project
  const selectProject = useCallback((projectId: string | null) => {
    if (!projectId) {
      setSelectedProject(null)
      localStorage.removeItem("selectedProjectId")
      return
    }
    
    const found = projects.find(p => p.id === projectId)
    if (found) {
      setSelectedProject(found)
      localStorage.setItem("selectedProjectId", projectId)
    }
  }, [projects])

  // Create a project
  const createProject = useCallback(async (data: Partial<Project>): Promise<Project | null> => {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create project")
      }
      
      const project = await res.json()
      setProjects(prev => [project, ...prev])
      setSelectedProject(project)
      localStorage.setItem("selectedProjectId", project.id)
      return project
    } catch (err) {
      console.error("Failed to create project:", err)
      setError(err instanceof Error ? err.message : "Failed to create project")
      return null
    }
  }, [])

  // Update a project
  const updateProject = useCallback(async (id: string, data: Partial<Project>): Promise<Project | null> => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update project")
      }
      
      const project = await res.json()
      setProjects(prev => prev.map(p => p.id === id ? project : p))
      if (selectedProject?.id === id) setSelectedProject(project)
      return project
    } catch (err) {
      console.error("Failed to update project:", err)
      setError(err instanceof Error ? err.message : "Failed to update project")
      return null
    }
  }, [selectedProject])

  // Delete a project
  const deleteProject = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete project")
      
      setProjects(prev => prev.filter(p => p.id !== id))
      if (selectedProject?.id === id) {
        setSelectedProject(null)
        localStorage.removeItem("selectedProjectId")
      }
      return true
    } catch (err) {
      console.error("Failed to delete project:", err)
      setError(err instanceof Error ? err.message : "Failed to delete project")
      return false
    }
  }, [selectedProject])

  return (
    <ProjectContext.Provider value={{
      projects,
      selectedProject,
      loading,
      error,
      selectProject,
      refreshProjects,
      createProject,
      updateProject,
      deleteProject,
    }}>
      {children}
    </ProjectContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useProject() {
  const context = useContext(ProjectContext)
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider")
  }
  return context
}
