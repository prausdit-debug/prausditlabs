/**
 * Prausdit Research Lab — Agent Engine
 * AI SDK 6.x (March 2026) — npm package "ai" latest: 6.0.116
 *
 * UPGRADED:
 *   - Planning-first system prompt with HITL rules
 *   - Loads active AgentFiles from DB and injects into system prompt
 *   - New TOOL_LABELS for research, planning, image upload
 *   - Updated workflow intent detection
 */

import { streamText, stepCountIs } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { prisma } from "./prisma"
import { agentTools } from "./agent-tools"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentMessage {
  role: "user" | "assistant"
  content: string
}

export interface AgentOptions {
  message: string
  history: AgentMessage[]
  provider: "gemini" | "openrouter"
  model: string
  systemContext?: string
}

// ─── Active Agent File Loader ─────────────────────────────────────────────────

interface AgentFileSection {
  system:  string[]  // type === "system"
  rules:   string[]  // type === "rules"
  tools:   string[]  // type === "tools"
}

async function loadActiveAgentFiles(): Promise<AgentFileSection> {
  const sections: AgentFileSection = { system: [], rules: [], tools: [] }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const files = await (prisma as any).agentFile.findMany({
      where: { isActive: true },
      select: { name: true, type: true, content: true },
      orderBy: { createdAt: "asc" },
    })
    for (const file of files as Array<{ name: string; type: string; content: string }>) {
      const type = file.type as keyof AgentFileSection
      if (sections[type] !== undefined) {
        sections[type].push(`<!-- ${file.name} -->\n${file.content}`)
      }
    }
  } catch {
    // AgentFile table may not exist yet — graceful fallback to base prompt
  }
  return sections
}

// ─── Base System Prompt ───────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `You are **Prausdit Lab Agent** — the autonomous AI brain of the Prausdit Research Lab.

You operate as a **planning-first reasoning agent**. You think step by step, create structured plans, wait for human approval, then execute with precision.

## Mission
Power development of **Protroit Agent** (offline-first SLM AI for mobile/edge) and **ProtroitOS** (agentic operating system) by automating research workflows.

---

## 🧠 CORE OPERATING RULES

### Rule 1 — PLAN FIRST, EXECUTE SECOND
For ANY complex request (multiple creations, research + writing, roadmaps, experiments, etc.):
1. Use \`research\` if external knowledge is needed
2. Use \`generate_plan\` to present a structured plan to the user
3. **WAIT** for explicit approval ("approve", "yes", "go ahead", "proceed")
4. ONLY THEN execute using CRM tools
5. Call \`finalize_execution\` when all steps are done

Simple requests (read doc, search KB, single quick answer) do NOT need a plan.

### Rule 2 — RESEARCH VIA \`research\` TOOL ONLY
- Use \`research\` for all external web research (handles Tavily→Brave→SerpAPI + crawling automatically)
- Use \`crawl_web\` ONLY for fetching a single specific known URL
- Never call search/crawl APIs manually

### Rule 3 — IMAGES GO TO CLOUDINARY
If execution includes images:
1. Generate or obtain image URL
2. Call \`upload_image\` → get permanent Cloudinary CDN URL
3. ONLY store/display Cloudinary URLs in documents/notes

### Rule 4 — SEARCH BEFORE CREATE
Always \`search_internal_docs\` before creating any entity to avoid duplicates.

### Rule 5 — NEVER SKIP APPROVAL
If a plan was generated, NEVER execute without seeing explicit approval.
If user gives feedback → use \`update_plan\` → wait for approval again.

### Rule 6 — ROADMAP PLANNING
For roadmap creation or large updates:
1. Generate roadmap plan structure with \`generate_plan\`
2. Show all phases, tasks, milestones
3. Wait for approval
4. Then call \`create_roadmap_step\` for each phase

---

## Tool Capabilities

### 🔬 Research
- \`research\` — Unified deep research: Tavily/Brave/SerpAPI + Firecrawl/Crawl4AI fallbacks. **Primary research tool.**

### 📋 Planning (Human-in-the-Loop)
- \`generate_plan\`     — Create structured plan. Must show to user before executing.
- \`update_plan\`       — Refine plan after feedback
- \`approve_plan\`      — Record user approval
- \`finalize_execution\` — Record completion + Cloudinary uploads

### 🖼️ Images
- \`upload_image\` — Upload URL → Cloudinary CDN → permanent HTTPS URL

### Knowledge & RAG
- \`search_internal_docs\` — Full-text search across all CRM entities
- \`get_knowledge_graph\`  — Entity relationship graph

### Documentation
- \`read_document\`   — Read page by slug
- \`create_document\` — Write comprehensive documentation (not placeholders)
- \`update_document\` — Patch existing docs

### Research Notes
- \`create_note\` — Save research note
- \`update_note\` — Update note

### Roadmap
- \`create_roadmap_step\`   — Add phase with tasks (after plan approval)
- \`update_roadmap_step\`   — Update progress
- \`complete_roadmap_task\` — Complete individual tasks

### Experiments
- \`create_experiment\` — Register ML experiment
- \`update_experiment\` — Record results

### Datasets
- \`create_dataset\`  — Register with metadata
- \`update_dataset\`  — Update preprocessing status
- \`analyze_dataset\` — Full analysis + experiment suggestions

### Model Benchmarking
- \`benchmark_model\`      — Record scores + generate report
- \`get_model_leaderboard\` — Ranked model comparison

### Web Research
- \`crawl_web\`              — Fetch single specific URL
- \`run_research_autopilot\` — Full research planning workflow

---

## AI Expertise
- SLMs: TinyLlama, Phi-3-mini, Gemma-2B, Mistral-7B, Qwen-1.5B
- Training: LoRA, QLoRA, GRPO, full fine-tune with trl/PEFT/transformers
- Quantization: GGUF, GPTQ, AWQ, INT4/INT8 for mobile/edge
- Datasets: JSONL instruction tuning, ShareGPT format, synthetic data
- Evaluation: BLEU, HumanEval pass@1, MMLU, MT-Bench
- Deployment: ONNX, Core ML, TFLite, llama.cpp on mobile

## Response Style
Rich Markdown with headings, tables, code blocks. Always confirm created entities with IDs.
When a plan is generated, present it clearly and ask for approval before proceeding.`

// ─── Build Final System Prompt ────────────────────────────────────────────────

async function buildSystemPrompt(extraContext?: string): Promise<string> {
  const files = await loadActiveAgentFiles()

  const parts: string[] = []

  // 1. Custom system files override/extend the base (if any)
  if (files.system.length > 0) {
    parts.push(files.system.join("\n\n"))
  } else {
    parts.push(BASE_SYSTEM_PROMPT)
  }

  // 2. Active rules files inject additional constraints
  if (files.rules.length > 0) {
    parts.push("---\n## Active Rules\n\n" + files.rules.join("\n\n---\n\n"))
  }

  // 3. Active tools files inject tool definitions/overrides
  if (files.tools.length > 0) {
    parts.push("---\n## Tool Configurations\n\n" + files.tools.join("\n\n---\n\n"))
  }

  // 4. Workflow-specific context
  if (extraContext) {
    parts.push("---\n## Active Workflow Context\n\n" + extraContext)
  }

  return parts.join("\n\n")
}

// ─── Provider Adapter ─────────────────────────────────────────────────────────

async function getModel(provider: "gemini" | "openrouter", modelId: string) {
  let settings: Awaited<ReturnType<typeof prisma.aISettings.findFirst>> | null = null
  try {
    settings = await prisma.aISettings.findFirst()
  } catch (dbErr) {
    console.warn("[agent-engine] Could not fetch AI settings:", dbErr instanceof Error ? dbErr.message : String(dbErr))
  }

  if (provider === "openrouter") {
    const apiKey = settings?.openrouterApiKey || process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error("OpenRouter API key not configured.\n\nAdd OPENROUTER_API_KEY to environment variables or configure in Settings → Manage API.")
    const openai = createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey, headers: { "HTTP-Referer": "https://prausdit.app", "X-Title": "Prausdit Research Lab" } })
    return openai(modelId)
  }

  const apiKey = settings?.geminiApiKey || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) throw new Error("Gemini API key not configured.\n\nSet GOOGLE_API_KEY in environment variables or configure in Settings → Manage API.")
  const google = createGoogleGenerativeAI({ apiKey })
  return google(modelId)
}

// ─── Tool Status Labels ───────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  // Existing
  search_internal_docs:     "Searching knowledge base",
  get_knowledge_graph:      "Loading knowledge graph",
  read_document:            "Reading documentation",
  create_document:          "Creating documentation page",
  update_document:          "Updating documentation",
  create_note:              "Saving research note",
  update_note:              "Updating research note",
  create_roadmap_step:      "Creating roadmap step",
  update_roadmap_step:      "Updating roadmap",
  complete_roadmap_task:    "Completing roadmap task",
  create_experiment:        "Creating experiment",
  update_experiment:        "Updating experiment",
  create_dataset:           "Creating dataset entry",
  update_dataset:           "Updating dataset",
  analyze_dataset:          "Analysing dataset intelligence",
  benchmark_model:          "Recording benchmark results",
  get_model_leaderboard:    "Loading model leaderboard",
  crawl_web:                "Fetching web content",
  run_research_autopilot:   "Running research autopilot",
  // New
  research:                 "Researching the web",
  generate_plan:            "Generating execution plan",
  update_plan:              "Refining plan",
  approve_plan:             "Recording plan approval",
  finalize_execution:       "Finalizing execution & saving report",
  upload_image:             "Uploading image to Cloudinary",
}

// ─── Workflow Intent Detection ────────────────────────────────────────────────

function detectWorkflowIntent(message: string): string {
  if (/start research|research for|research on|investigate/i.test(message))
    return "Research Autopilot activated — analysing knowledge graph and planning research workflow..."
  if (/plan experiments?|create experiments? for|design experiments?/i.test(message))
    return "Experiment Planner activated — analysing datasets and designing experiment suite..."
  if (/benchmark|evaluate model|score model|rank model/i.test(message))
    return "Benchmark Automation activated — preparing evaluation pipeline..."
  if (/analyse dataset|analyze dataset|dataset intelligence/i.test(message))
    return "Dataset Intelligence activated — performing deep dataset analysis..."
  if (/(training|pipeline|milestone|roadmap).*(done|complete|finished)|finished.*training/i.test(message))
    return "Roadmap Autopilot activated — updating milestones and planning next steps..."
  if (/\/document|create doc|write doc|generate doc|document this/i.test(message))
    return "Documentation Automation activated — searching for existing docs first..."
  if (/\/experiment/i.test(message))
    return "Experiment creation mode — checking related experiments and datasets..."
  if (/\/dataset/i.test(message))
    return "Dataset registration mode — checking for similar datasets..."
  if (/\/roadmap|roadmap.*plan|plan.*roadmap/i.test(message))
    return "Roadmap planner — generating plan structure before creating..."
  if (/\/note/i.test(message))
    return "Research note mode — saving your note..."
  if (/leaderboard|ranking|best model|top model/i.test(message))
    return "Loading model leaderboard..."
  // New intent patterns
  if (/\bresearch\b|find out|look up|search for|investigate/i.test(message))
    return "Researching... searching web providers with automatic fallback..."
  if (/\bplan\b|create a plan|build a plan|design a/i.test(message))
    return "Planning mode — generating structured plan for your approval..."
  if (/^approve$|^yes$|go ahead|proceed with|execute the plan/i.test(message.trim()))
    return "Executing approved plan..."
  if (/upload.*image|image.*cloudinary|store.*image/i.test(message))
    return "Uploading image to Cloudinary CDN..."
  if (message.toLowerCase().includes("@documentation") || message.toLowerCase().includes("@docs"))
    return "Fetching referenced documentation..."
  if (/search|find|look up/i.test(message))
    return "Searching knowledge base..."
  return "Agent thinking..."
}

// ─── Main Agent Runner ────────────────────────────────────────────────────────

export function runAgent(options: AgentOptions): ReadableStream<Uint8Array> {
  const { message, history, provider, model, systemContext } = options
  const encoder = new TextEncoder()

  function evt(payload: object): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
  }

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...history.slice(-14),
    { role: "user", content: message },
  ]

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const initialStatus = detectWorkflowIntent(message)
        controller.enqueue(evt({ type: "status", text: initialStatus, step: 0 }))

        // Build system prompt — loads active agent files from DB
        const systemPrompt = await buildSystemPrompt(systemContext)

        const aiModel = await getModel(provider, model)
        let stepNum = 0

        const result = streamText({
          model: aiModel,
          system: systemPrompt,
          messages,
          tools: agentTools,
          stopWhen: stepCountIs(20),
          maxRetries: 1,
          temperature: 0.65,
        })

        for await (const chunk of result.fullStream) {
          try {
            if (chunk.type === "tool-call") {
              stepNum++
              const label = TOOL_LABELS[chunk.toolName] || `Calling ${chunk.toolName}`
              controller.enqueue(evt({ type: "tool_call", tool: chunk.toolName, text: label, args: chunk.input, step: stepNum }))
            }
            if (chunk.type === "tool-result") {
              const resultPreview = typeof chunk.output === "object"
                ? JSON.stringify(chunk.output).slice(0, 200)
                : String(chunk.output ?? "").slice(0, 200)
              controller.enqueue(evt({ type: "tool_result", tool: chunk.toolName, text: `${TOOL_LABELS[chunk.toolName] || chunk.toolName} complete`, result: chunk.output, resultPreview, step: stepNum }))
              controller.enqueue(evt({ type: "status", text: "Analysing results...", step: stepNum }))
            }
            if (chunk.type === "text-delta" && chunk.text) {
              controller.enqueue(evt({ type: "text", text: chunk.text }))
            }
          } catch { /* ignore serialization errors */ }
        }

        controller.enqueue(evt({ type: "done" }))
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        try {
          controller.enqueue(evt({ type: "error", text: msg }))
          controller.enqueue(evt({ type: "done" }))
          controller.close()
        } catch { /* controller already closed */ }
      }
    },
  })
}

// ─── Workflow Trigger Helpers ─────────────────────────────────────────────────

export function runWorkflow(
  workflowType: "documentation_automation" | "roadmap_autopilot" | "experiment_planning" | "research_autopilot" | "dataset_intelligence" | "model_benchmark",
  payload: Record<string, unknown>,
  options: Omit<AgentOptions, "message" | "systemContext">
): ReadableStream<Uint8Array> {
  const workflowMessages: Record<string, string> = {
    documentation_automation: `Generate comprehensive documentation for the following: ${JSON.stringify(payload)}. Use create_document to save it.`,
    roadmap_autopilot: `Update the roadmap based on this completion event: ${JSON.stringify(payload)}. Mark completed, create next steps.`,
    experiment_planning: `Plan and create experiments for this topic: ${JSON.stringify(payload)}. Use generate_plan first, then create_experiment after approval.`,
    research_autopilot: `Start a full research autopilot workflow for: ${JSON.stringify(payload)}. Run research tool first, then generate_plan, create notes and documentation after approval.`,
    dataset_intelligence: `Perform full dataset intelligence analysis for dataset ID: ${JSON.stringify(payload)}. Use analyze_dataset, then create documentation and suggest experiments.`,
    model_benchmark: `Process benchmark results for model: ${JSON.stringify(payload)}. Use benchmark_model to record scores and generate report.`,
  }
  const message = workflowMessages[workflowType] || `Execute workflow: ${workflowType} with payload: ${JSON.stringify(payload)}`
  const systemContext = `ACTIVE WORKFLOW: ${workflowType}\nPayload: ${JSON.stringify(payload, null, 2)}`
  return runAgent({ ...options, message, systemContext })
}
