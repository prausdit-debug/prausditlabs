"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useProject, ProjectType, ProjectConfig } from "./project-context"
import {
  X, Cpu, Globe, Server, Sparkles, ChevronRight,
  Loader2, Check, AlertCircle,
} from "lucide-react"

// ─── Constants ───────────────────────────────────────────────────────────────

const PROJECT_TYPES: Array<{
  id: ProjectType
  name: string
  description: string
  icon: React.ElementType
  color: string
}> = [
  {
    id: "MODEL",
    name: "Model Project",
    description: "LLM/SLM development and fine-tuning",
    icon: Cpu,
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20",
  },
  {
    id: "FRONTEND",
    name: "Frontend Project",
    description: "Web, mobile, or desktop applications",
    icon: Globe,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20",
  },
  {
    id: "BACKEND",
    name: "Backend Project",
    description: "Server, API, or cloud infrastructure",
    icon: Server,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20",
  },
  {
    id: "CUSTOM",
    name: "Custom Project",
    description: "Full-stack or custom structure",
    icon: Sparkles,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20",
  },
]

const MODEL_TYPES = ["LLM", "SLM", "other"] as const
const TARGET_PLATFORMS = ["Android", "iOS", "Linux", "Windows", "macOS", "Web / Browser"] as const
const FRONTEND_FRAMEWORKS = ["React", "Next.js", "Vue", "Flutter", "Electron", "Tauri", "Swift UI", "Kotlin"] as const
const BACKEND_ENVIRONMENTS = ["Server", "Local device", "Linux", "Cloud"] as const
const BACKEND_FRAMEWORKS = ["Node.js", "Python", "Go", "Rust", "Java", "C#", ".NET"] as const
const PROGRAMMING_LANGUAGES = ["JavaScript", "TypeScript", "Python", "Rust", "Go", "Swift", "Kotlin", "Java", "C++", "C#"] as const

// ─── Component ───────────────────────────────────────────────────────────────

interface CreateProjectDialogProps {
  open: boolean
  onClose: () => void
}

export function CreateProjectDialog({ open, onClose }: CreateProjectDialogProps) {
  const { createProject } = useProject()
  
  // Step state
  const [step, setStep] = useState<"type" | "details">("type")
  const [selectedType, setSelectedType] = useState<ProjectType | null>(null)
  
  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [config, setConfig] = useState<ProjectConfig>({})
  
  // UI state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setStep("type")
    setSelectedType(null)
    setName("")
    setDescription("")
    setConfig({})
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSelectType = (type: ProjectType) => {
    setSelectedType(type)
    setStep("details")
  }

  const handleBack = () => {
    setStep("type")
    setError(null)
  }

  const handleSubmit = async () => {
    if (!selectedType || !name.trim()) {
      setError("Please fill in all required fields")
      return
    }

    setSubmitting(true)
    setError(null)

    const project = await createProject({
      name: name.trim(),
      type: selectedType,
      description: description.trim() || undefined,
      config: Object.keys(config).length > 0 ? config : undefined,
    })

    setSubmitting(false)

    if (project) {
      handleClose()
    } else {
      setError("Failed to create project. Please try again.")
    }
  }

  const toggleArrayConfig = (key: keyof ProjectConfig, value: string) => {
    setConfig(prev => {
      const arr = (prev[key] as string[] | undefined) || []
      if (arr.includes(value)) {
        return { ...prev, [key]: arr.filter(v => v !== value) }
      }
      return { ...prev, [key]: [...arr, value] }
    })
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />
      
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="pointer-events-auto w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">
                {step === "type" ? "Create New Project" : `New ${PROJECT_TYPES.find(t => t.id === selectedType)?.name}`}
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {step === "type" ? "Select a project type to get started" : "Configure your project settings"}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 max-h-[60vh] overflow-y-auto">
            {step === "type" ? (
              <div className="grid grid-cols-2 gap-3">
                {PROJECT_TYPES.map(type => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.id}
                      onClick={() => handleSelectType(type.id)}
                      className={cn(
                        "flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all",
                        type.color
                      )}
                    >
                      <Icon className="w-6 h-6" />
                      <div>
                        <p className="text-[13px] font-semibold">{type.name}</p>
                        <p className="text-[11px] opacity-70">{type.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Project Name */}
                <div>
                  <label className="block text-[12px] font-semibold text-foreground mb-1.5">
                    Project Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="My Awesome Project"
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[12px] font-semibold text-foreground mb-1.5">
                    Description <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Brief description of your project..."
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>

                {/* Type-specific fields */}
                {selectedType === "MODEL" && (
                  <>
                    <div>
                      <label className="block text-[12px] font-semibold text-foreground mb-1.5">
                        Model Type
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {MODEL_TYPES.map(type => (
                          <button
                            key={type}
                            onClick={() => setConfig(prev => ({ ...prev, modelType: type }))}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors",
                              config.modelType === type
                                ? "bg-purple-500/20 border-purple-500/30 text-purple-400"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                          >
                            {type === "other" ? "Other" : type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-foreground mb-1.5">
                        Model ID <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={config.modelId || ""}
                        onChange={e => setConfig(prev => ({ ...prev, modelId: e.target.value }))}
                        placeholder="e.g., protroit-7b-v1"
                        className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </>
                )}

                {selectedType === "FRONTEND" && (
                  <>
                    <div>
                      <label className="block text-[12px] font-semibold text-foreground mb-1.5">
                        Target Platform(s)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {TARGET_PLATFORMS.map(platform => (
                          <button
                            key={platform}
                            onClick={() => toggleArrayConfig("targetPlatform", platform)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors flex items-center gap-1.5",
                              config.targetPlatform?.includes(platform)
                                ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                          >
                            {config.targetPlatform?.includes(platform) && <Check className="w-3 h-3" />}
                            {platform}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-foreground mb-1.5">
                        Framework(s)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {FRONTEND_FRAMEWORKS.map(fw => (
                          <button
                            key={fw}
                            onClick={() => toggleArrayConfig("frameworks", fw)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors flex items-center gap-1.5",
                              config.frameworks?.includes(fw)
                                ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                          >
                            {config.frameworks?.includes(fw) && <Check className="w-3 h-3" />}
                            {fw}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-foreground mb-1.5">
                        Programming Language(s)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {PROGRAMMING_LANGUAGES.slice(0, 6).map(lang => (
                          <button
                            key={lang}
                            onClick={() => toggleArrayConfig("languages", lang)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors flex items-center gap-1.5",
                              config.languages?.includes(lang)
                                ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                          >
                            {config.languages?.includes(lang) && <Check className="w-3 h-3" />}
                            {lang}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {selectedType === "BACKEND" && (
                  <>
                    <div>
                      <label className="block text-[12px] font-semibold text-foreground mb-1.5">
                        Backend Environment
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {BACKEND_ENVIRONMENTS.map(env => (
                          <button
                            key={env}
                            onClick={() => toggleArrayConfig("environment", env)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors flex items-center gap-1.5",
                              config.environment?.includes(env)
                                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                          >
                            {config.environment?.includes(env) && <Check className="w-3 h-3" />}
                            {env}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-foreground mb-1.5">
                        Framework / Language
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {BACKEND_FRAMEWORKS.map(fw => (
                          <button
                            key={fw}
                            onClick={() => toggleArrayConfig("backendFrameworks", fw)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors flex items-center gap-1.5",
                              config.backendFrameworks?.includes(fw)
                                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                          >
                            {config.backendFrameworks?.includes(fw) && <Check className="w-3 h-3" />}
                            {fw}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-foreground mb-1.5">
                        RAM / Compute Requirements <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={config.ramRequirements || ""}
                        onChange={e => setConfig(prev => ({ ...prev, ramRequirements: e.target.value }))}
                        placeholder="e.g., 16GB RAM, 4 vCPU"
                        className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </>
                )}

                {selectedType === "CUSTOM" && (
                  <div>
                    <label className="block text-[12px] font-semibold text-foreground mb-1.5">
                      Custom Structure <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={config.customStructure || ""}
                      onChange={e => setConfig(prev => ({ ...prev, customStructure: e.target.value }))}
                      placeholder="Describe your project structure (e.g., full-stack, monorepo, microservices)..."
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50 resize-none"
                    />
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {step === "details" && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-muted/20">
              <button
                onClick={handleBack}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !name.trim()}
                className={cn(
                  "flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-medium transition-colors",
                  submitting || !name.trim()
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-amber-500 text-black hover:bg-amber-400"
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Project"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
