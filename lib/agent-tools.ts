/**
 * Prausdit Research Lab — Agent Tools (AI SDK v6)
 *
 * UPGRADED: All new tools merged directly into this file.
 * No separate extended file — single source of truth.
 *
 * All tools execute through Prisma only — no shell access, no arbitrary
 * filesystem access. Security boundary enforced here.
 *
 * New tools added (upgrade layer):
 *   - research            → unified deep research (Tavily→Brave→SerpAPI + Firecrawl→Crawl4AI)
 *   - generate_plan       → planning-first: create structured plan for user approval
 *   - update_plan         → refine plan based on user feedback
 *   - approve_plan        → record human approval before execution
 *   - finalize_execution  → record completion + Cloudinary image uploads
 *   - upload_image        → upload image URL to Cloudinary CDN
 */

import { tool } from "ai"
import { z } from "zod"
import { prisma } from "./prisma"

// ─── Prisma JSON type alias ────────────────────────────────────────────────────
type InputJsonValue =
  | string
  | number
  | boolean
  | { [key: string]: InputJsonValue }
  | InputJsonValue[]

// ════════════════════════════════════════════════════════════════════════════════
// SECTION A — SHARED UTILITIES
// ════════════════════════════════════════════════════════════════════════════════

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 8000)
}

function truncate(text: string, maxLen = 4000): string {
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text
}

// ─── Security: block SSRF targets ─────────────────────────────────────────────
const BLOCKED_HOSTS = [
  "localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254",
  "metadata.google", "instance-data", "192.168.", "10.",
  "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.",
  "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.",
  "172.28.", "172.29.", "172.30.", "172.31.", "::1",
]
function isSafeUrl(url: string): boolean {
  if (!url.startsWith("https://")) return false
  return !BLOCKED_HOSTS.some((b) => url.includes(b))
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION B — RESEARCH ENGINE (inline, no external file dependency)
// ════════════════════════════════════════════════════════════════════════════════

interface ResearchResult {
  title: string
  url: string
  snippet: string
  content?: string
  source: string
  score?: number
}

interface DeepResearchOutput {
  query: string
  results: ResearchResult[]
  summary: string
  sources: string[]
  provider: string
  crawlProvider?: string
  crawledCount: number
  error?: string
}

function getResearchConfig() {
  return {
    tavily:    process.env.TAVILY_API_KEY    || null,
    brave:     process.env.BRAVE_API_KEY     || null,
    serpapi:   process.env.SERPAPI_KEY       || null,
    firecrawl: process.env.FIRECRAWL_API_KEY || null,
    crawl4ai:  process.env.CRAWL4AI_API_URL  || null,
  }
}

async function searchTavily(query: string, cfg: ReturnType<typeof getResearchConfig>): Promise<ResearchResult[] | null> {
  if (!cfg.tavily) return null
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: cfg.tavily, query, search_depth: "advanced", max_results: 6 }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.results || []).map((r: { title?: string; url: string; content?: string; score?: number }) => ({
      title: r.title || r.url, url: r.url, snippet: r.content || "", source: "tavily", score: r.score,
    }))
  } catch { return null }
}

async function searchBrave(query: string, cfg: ReturnType<typeof getResearchConfig>): Promise<ResearchResult[] | null> {
  if (!cfg.brave) return null
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6`, {
      headers: { "Accept": "application/json", "X-Subscription-Token": cfg.brave },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.web?.results || []).map((r: { title: string; url: string; description?: string }) => ({
      title: r.title, url: r.url, snippet: r.description || "", source: "brave",
    }))
  } catch { return null }
}

async function searchSerpApi(query: string, cfg: ReturnType<typeof getResearchConfig>): Promise<ResearchResult[] | null> {
  if (!cfg.serpapi) return null
  try {
    const res = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=6&api_key=${cfg.serpapi}`, {
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.organic_results || []).map((r: { title: string; link: string; snippet?: string }) => ({
      title: r.title, url: r.link, snippet: r.snippet || "", source: "serpapi",
    }))
  } catch { return null }
}

async function searchWithFallback(query: string): Promise<{ results: ResearchResult[]; provider: string }> {
  const cfg = getResearchConfig()
  const tavily = await searchTavily(query, cfg)
  if (tavily && tavily.length > 0) return { results: tavily, provider: "tavily" }
  const brave = await searchBrave(query, cfg)
  if (brave && brave.length > 0) return { results: brave, provider: "brave" }
  const serp = await searchSerpApi(query, cfg)
  if (serp && serp.length > 0) return { results: serp, provider: "serpapi" }
  return { results: [], provider: "none" }
}

async function crawlFirecrawl(url: string, cfg: ReturnType<typeof getResearchConfig>): Promise<string | null> {
  if (!cfg.firecrawl || !isSafeUrl(url)) return null
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cfg.firecrawl}` },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.markdown ? truncate(data.data.markdown) : null
  } catch { return null }
}

async function crawlCrawl4AI(url: string, cfg: ReturnType<typeof getResearchConfig>): Promise<string | null> {
  if (!cfg.crawl4ai || !isSafeUrl(url)) return null
  try {
    const res = await fetch(`${cfg.crawl4ai}/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: [url], word_count_threshold: 50 }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const result = Array.isArray(data.results) ? data.results[0] : data
    return result?.markdown ? truncate(result.markdown) : null
  } catch { return null }
}

async function crawlBasicFetch(url: string): Promise<string | null> {
  if (!isSafeUrl(url)) return null
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Prausdit-LabBot/2.0 (Research AI; +https://prausdit.app)", "Accept": "text/html,text/plain,text/markdown" },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const ct = res.headers.get("content-type") || ""
    const raw = await res.text()
    return truncate(ct.includes("text/plain") || ct.includes("text/markdown") ? raw : stripHtml(raw))
  } catch { return null }
}

async function crawlWithFallback(url: string): Promise<{ content: string | null; provider: string }> {
  const cfg = getResearchConfig()
  const fc = await crawlFirecrawl(url, cfg)
  if (fc) return { content: fc, provider: "firecrawl" }
  const c4 = await crawlCrawl4AI(url, cfg)
  if (c4) return { content: c4, provider: "crawl4ai" }
  const basic = await crawlBasicFetch(url)
  if (basic) return { content: basic, provider: "basic-fetch" }
  return { content: null, provider: "none" }
}

async function deepResearch(query: string, options: { maxCrawl?: number; crawlEnabled?: boolean } = {}): Promise<DeepResearchOutput> {
  const { maxCrawl = 2, crawlEnabled = true } = options
  try {
    const { results: searchResults, provider } = await searchWithFallback(query)
    if (searchResults.length === 0) {
      return {
        query, results: [], sources: [], provider, crawledCount: 0,
        summary: provider === "none"
          ? `No search API keys configured. Set TAVILY_API_KEY, BRAVE_API_KEY, or SERPAPI_KEY.`
          : `No results found for "${query}".`,
        error: provider === "none" ? "No search API keys configured." : undefined,
      }
    }
    let crawlProvider: string | undefined
    let crawledCount = 0
    if (crawlEnabled) {
      for (const result of searchResults.filter((r) => isSafeUrl(r.url)).slice(0, maxCrawl)) {
        const { content, provider: cp } = await crawlWithFallback(result.url)
        if (content) { result.content = content; crawlProvider = cp; crawledCount++ }
      }
    }
    const sources = [...new Set(searchResults.map((r) => r.url))]
    const snippets = searchResults.slice(0, 4).map((r, i) => `${i + 1}. **${r.title}** — ${r.snippet.slice(0, 200)}`).join("\n")
    const summary = `Found ${searchResults.length} results via ${provider} for "${query}":\n\n${snippets}`
    return { query, results: searchResults, summary, sources, provider, crawlProvider, crawledCount }
  } catch (err) {
    return { query, results: [], summary: `Research failed: ${String(err)}`, sources: [], provider: "error", crawledCount: 0, error: String(err) }
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION C — CLOUDINARY HELPER (inline)
// ════════════════════════════════════════════════════════════════════════════════

function isCloudinaryConfigured(): boolean {
  return !!process.env.CLOUDINARY_CLOUD_NAME && (
    !!process.env.CLOUDINARY_UPLOAD_PRESET ||
    (!!process.env.CLOUDINARY_API_KEY && !!process.env.CLOUDINARY_API_SECRET)
  )
}

interface CloudinaryUploadResult {
  url: string; publicId: string; width?: number; height?: number; format?: string; bytes?: number
}

async function uploadToCloudinary(imageData: Buffer | string, options: { filename?: string; folder?: string; tags?: string[] } = {}): Promise<CloudinaryUploadResult | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  if (!cloudName) return null
  const base64 = Buffer.isBuffer(imageData)
    ? `data:image/png;base64,${imageData.toString("base64")}`
    : imageData.startsWith("data:") ? imageData : `data:image/png;base64,${imageData}`
  const folder   = options.folder   || process.env.CLOUDINARY_FOLDER || "prausdit-lab"
  const tags     = options.tags     || ["agent-generated"]
  const filename = options.filename || `img-${Date.now()}`
  const preset   = process.env.CLOUDINARY_UPLOAD_PRESET
  if (preset) {
    try {
      const body = new FormData()
      body.append("file", base64); body.append("upload_preset", preset)
      body.append("folder", folder); body.append("public_id", filename); body.append("tags", tags.join(","))
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body, signal: AbortSignal.timeout(30000) })
      if (!res.ok) return null
      const data = await res.json()
      return { url: data.secure_url, publicId: data.public_id, width: data.width, height: data.height, format: data.format, bytes: data.bytes }
    } catch { return null }
  }
  return null
}

async function downloadAndUpload(imageUrl: string, options: { filename?: string; folder?: string; tags?: string[] } = {}): Promise<CloudinaryUploadResult | null> {
  try {
    if (!imageUrl.startsWith("https://")) return null
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    return uploadToCloudinary(buffer, options)
  } catch { return null }
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION D — PLAN MARKDOWN BUILDER
// ════════════════════════════════════════════════════════════════════════════════

function buildPlanMarkdown(
  title: string,
  overview: string,
  sections: Array<{ heading: string; subheading?: string; description: string; steps: string[]; toolsRequired?: string[] }>,
  sources?: Array<{ title: string; url: string }>,
  imagePlan?: { needed: boolean; description?: string } | null
): string {
  const lines: string[] = [`# 📋 Plan: ${title}`, "", `> ${overview}`, "", "---", ""]
  sections.forEach((s, i) => {
    lines.push(`## ${i + 1}. ${s.heading}`)
    if (s.subheading) lines.push(`### ${s.subheading}`)
    lines.push("", s.description, "", "**Steps:**")
    s.steps.forEach((step, j) => lines.push(`${j + 1}. ${step}`))
    if (s.toolsRequired?.length) lines.push("", `*Tools: ${s.toolsRequired.join(", ")}*`)
    lines.push("")
  })
  if (imagePlan?.needed) lines.push("## 🖼️ Image Plan", "", imagePlan.description || "Images will be uploaded to Cloudinary.", "")
  if (sources?.length) {
    lines.push("## 📚 Sources", "")
    sources.forEach((s, i) => lines.push(`${i + 1}. [${s.title}](${s.url})`))
    lines.push("")
  }
  lines.push("---", "*Awaiting approval. Reply **approve** to execute, or provide feedback to refine.*")
  return lines.join("\n")
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 1 — KNOWLEDGE GRAPH / RAG SEARCH (existing, unchanged)
// ════════════════════════════════════════════════════════════════════════════════

export const searchInternalDocs = tool({
  description:
    "Search the internal knowledge base including documentation pages, experiments, datasets, notes, and roadmap steps. Use this to find existing research, avoid duplicates, and retrieve context before creating new content. Supports full-text search across all CRM entities.",
  inputSchema: z.object({
    query: z.string().describe("Search query (keywords or natural language phrases)"),
    sources: z.array(z.enum(["docs", "experiments", "datasets", "notes", "roadmap", "models"])).optional().describe("Which sources to search. Omit to search all."),
    limit: z.number().int().min(1).max(10).optional().default(4),
  }),
  execute: async ({ query, sources, limit = 4 }) => {
    const searchAll = !sources || sources.length === 0
    const results: Record<string, unknown[]> = {}
    try {
      if (searchAll || sources?.includes("docs")) {
        const docs = await prisma.documentationPage.findMany({
          where: { OR: [{ title: { contains: query, mode: "insensitive" } }, { content: { contains: query, mode: "insensitive" } }, { section: { contains: query, mode: "insensitive" } }, { tags: { hasSome: query.split(" ") } }] },
          select: { id: true, title: true, slug: true, section: true, content: true, tags: true, progress: true, updatedAt: true },
          take: limit, orderBy: { updatedAt: "desc" },
        })
        results.documentation = docs.map((d) => ({ ...d, content: d.content.slice(0, 1000) + (d.content.length > 1000 ? "…" : "") }))
      }
      if (searchAll || sources?.includes("experiments")) {
        results.experiments = await prisma.experiment.findMany({
          where: { OR: [{ name: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }, { baseModel: { contains: query, mode: "insensitive" } }, { method: { contains: query, mode: "insensitive" } }, { resultSummary: { contains: query, mode: "insensitive" } }] },
          select: { id: true, name: true, status: true, baseModel: true, description: true, resultSummary: true, method: true, evalLoss: true, evalAccuracy: true, bleuScore: true, pass1Score: true, createdAt: true },
          take: limit, orderBy: { createdAt: "desc" },
        })
      }
      if (searchAll || sources?.includes("datasets")) {
        results.datasets = await prisma.dataset.findMany({
          where: { OR: [{ name: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }, { tags: { hasSome: query.split(" ") } }] },
          select: { id: true, name: true, datasetType: true, description: true, numSamples: true, preprocessStatus: true, format: true, license: true },
          take: limit, orderBy: { createdAt: "desc" },
        })
      }
      if (searchAll || sources?.includes("notes")) {
        const notes = await prisma.note.findMany({
          where: { OR: [{ title: { contains: query, mode: "insensitive" } }, { content: { contains: query, mode: "insensitive" } }, { tags: { hasSome: query.split(" ") } }] },
          select: { id: true, title: true, content: true, tags: true, pinned: true, updatedAt: true },
          take: limit, orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        })
        results.notes = notes.map((n) => ({ ...n, content: n.content.slice(0, 600) + (n.content.length > 600 ? "…" : "") }))
      }
      if (searchAll || sources?.includes("roadmap")) {
        results.roadmap = await prisma.roadmapStep.findMany({
          where: { OR: [{ title: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }, { milestone: { contains: query, mode: "insensitive" } }] },
          select: { id: true, title: true, phase: true, status: true, description: true, progressPercent: true, milestone: true, priority: true },
          take: limit, orderBy: { phase: "asc" },
        })
      }
      if (searchAll || sources?.includes("models")) {
        results.models = await prisma.modelVersion.findMany({
          where: { OR: [{ name: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }, { version: { contains: query, mode: "insensitive" } }] },
          select: { id: true, name: true, version: true, description: true, bleuScore: true, pass1Score: true, humanEval: true, mmluScore: true, quantization: true, isDeployed: true },
          take: limit, orderBy: { createdAt: "desc" },
        })
      }
      const totalFound = Object.values(results).reduce((acc, arr) => acc + arr.length, 0)
      return { query, totalFound, results }
    } catch (err) {
      return { query, totalFound: 0, results: {}, error: String(err) }
    }
  },
})

export const getKnowledgeGraph = tool({
  description: "Retrieve a knowledge graph showing relationships between CRM entities. Returns datasets linked to experiments, experiments linked to models, and roadmap steps with tasks. Use this for research autopilot workflows to understand the full project context.",
  inputSchema: z.object({ includeMetrics: z.boolean().optional().default(false).describe("Include benchmark metrics in model nodes") }),
  execute: async ({ includeMetrics = false }) => {
    try {
      const [experiments, datasets, roadmapPhases, models, recentNotes] = await Promise.all([
        prisma.experiment.findMany({ select: { id: true, name: true, status: true, baseModel: true, method: true, datasetId: true, evalLoss: true, evalAccuracy: true, modelVersions: { select: { id: true, name: true, version: true } } }, take: 20, orderBy: { createdAt: "desc" } }),
        prisma.dataset.findMany({ select: { id: true, name: true, datasetType: true, numSamples: true, preprocessStatus: true }, take: 20, orderBy: { createdAt: "desc" } }),
        prisma.roadmapStep.findMany({ select: { id: true, title: true, phase: true, status: true, progressPercent: true, priority: true, tasks: { select: { id: true, title: true, completed: true } } }, orderBy: { phase: "asc" }, take: 30 }),
        prisma.modelVersion.findMany({ select: { id: true, name: true, version: true, isDeployed: true, quantization: true, ...(includeMetrics ? { bleuScore: true, pass1Score: true, humanEval: true, mmluScore: true } : {}) }, take: 10, orderBy: { createdAt: "desc" } }),
        prisma.note.findMany({ select: { id: true, title: true, tags: true }, take: 10, orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }] }),
      ])
      return {
        summary: { totalExperiments: experiments.length, totalDatasets: datasets.length, totalRoadmapSteps: roadmapPhases.length, totalModels: models.length, recentNoteCount: recentNotes.length },
        nodes: { experiments, datasets, roadmapSteps: roadmapPhases, models, recentNotes },
        relationships: experiments.map((e) => ({ experimentId: e.id, experimentName: e.name, datasetId: e.datasetId, linkedModels: e.modelVersions.map((m) => m.id) })),
      }
    } catch (err) { return { error: String(err) } }
  },
})

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 2 — DOCUMENTATION TOOLS (existing, unchanged)
// ════════════════════════════════════════════════════════════════════════════════

export const readDocument = tool({
  description: "Read the full content of a specific documentation page by its slug.",
  inputSchema: z.object({ slug: z.string().describe("The documentation page slug (e.g. 'slm-training-pipeline')") }),
  execute: async ({ slug }) => {
    try {
      const page = await prisma.documentationPage.findUnique({ where: { slug } })
      if (!page) return { error: `No documentation page found with slug "${slug}"` }
      return { id: page.id, title: page.title, slug: page.slug, section: page.section, content: page.content, tags: page.tags, progress: page.progress }
    } catch (err) { return { error: String(err) } }
  },
})

export const createDocument = tool({
  description: "Create a new documentation page in the Prausdit Research Lab knowledge base. Use for /document commands, auto-documentation after experiments, and research reports. Write comprehensive, technical content — not placeholders.",
  inputSchema: z.object({
    title: z.string().describe("Page title"),
    slug: z.string().describe("URL slug (kebab-case, unique)"),
    section: z.string().describe("Section category (e.g. 'Research', 'Architecture', 'Training', 'Benchmarks', 'Datasets')"),
    content: z.string().describe("Full documentation content in Markdown with headings, code blocks, tables, etc. Be comprehensive."),
    tags: z.array(z.string()).optional().describe("Relevant tags"),
    progress: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]).optional().default("COMPLETED"),
    projectId: z.string().optional().describe("Project ID to scope this document to"),
  }),
  execute: async ({ title, slug, section, content, tags, progress, projectId }) => {
    try {
      const existing = await prisma.documentationPage.findUnique({ where: { slug } })
      if (existing) {
        const newSlug = `${slug}-${Date.now()}`
        const page = await prisma.documentationPage.create({ data: { title, slug: newSlug, section, content, tags: tags || [], order: 99, progress: progress ?? "COMPLETED", projectId: projectId ?? null } })
        return { success: true, id: page.id, slug: page.slug, note: "Slug was taken — used unique alternative" }
      }
      const page = await prisma.documentationPage.create({ data: { title, slug, section, content, tags: tags || [], order: 99, progress: progress ?? "COMPLETED", projectId: projectId ?? null } })
      return { success: true, id: page.id, slug: page.slug, title: page.title }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

export const updateDocument = tool({
  description: "Update an existing documentation page by its slug. Use for incremental improvements, adding benchmark results, or updating research findings.",
  inputSchema: z.object({
    slug: z.string().describe("The slug of the page to update"),
    title: z.string().optional(), content: z.string().optional(), section: z.string().optional(),
    tags: z.array(z.string()).optional(), progress: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]).optional(),
  }),
  execute: async ({ slug, ...updates }) => {
    try {
      const page = await prisma.documentationPage.update({ where: { slug }, data: updates })
      return { success: true, id: page.id, slug: page.slug }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 3 — RESEARCH NOTES (existing, unchanged)
// ════════════════════════════════════════════════════════════════════════════════

export const createNote = tool({
  description: "Create a new research note. Use for /note commands, research findings summaries, web research summaries, and saving important discoveries.",
  inputSchema: z.object({
    title: z.string().describe("Note title"),
    content: z.string().describe("Note content in Markdown. Be detailed and include sources/references."),
    tags: z.array(z.string()).optional(),
    pinned: z.boolean().optional().default(false),
    projectId: z.string().optional().describe("Project ID to scope this note to"),
  }),
  execute: async ({ title, content, tags, pinned, projectId }) => {
    try {
      const note = await prisma.note.create({ data: { title, content, tags: tags || [], pinned: pinned ?? false, projectId: projectId ?? null } })
      return { success: true, id: note.id, title: note.title }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

export const updateNote = tool({
  description: "Update an existing research note by its ID.",
  inputSchema: z.object({
    id: z.string().describe("Note ID"),
    title: z.string().optional(), content: z.string().optional(),
    tags: z.array(z.string()).optional(), pinned: z.boolean().optional(),
  }),
  execute: async ({ id, ...updates }) => {
    try {
      const note = await prisma.note.update({ where: { id }, data: updates })
      return { success: true, id: note.id, title: note.title }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 4 — ROADMAP AUTOPILOT (existing, unchanged)
// ════════════════════════════════════════════════════════════════════════════════

export const createRoadmapStep = tool({
  description: "Create a new roadmap step/phase entry. Use for /roadmap commands and research autopilot workflows. Always check existing phases first. For complex roadmaps, generate a plan first and wait for approval.",
  inputSchema: z.object({
    title: z.string().describe("Step title"),
    phase: z.number().int().describe("Phase number (1, 2, 3, ...)"),
    description: z.string().describe("Detailed description of this roadmap step"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().default("MEDIUM"),
    milestone: z.string().optional().describe("Milestone name or goal"),
    tasks: z.array(z.string()).optional().describe("List of task titles for this step"),
    estimatedCompletion: z.string().optional().describe("ISO date string for estimated completion"),
    projectId: z.string().optional().describe("Project ID to scope this roadmap step to"),
  }),
  execute: async ({ title, phase, description, priority, milestone, tasks, estimatedCompletion, projectId }) => {
    try {
      const step = await prisma.roadmapStep.create({
        data: { title, phase, description, priority: priority ?? "MEDIUM", milestone, status: "PENDING", order: 99, estimatedCompletion: estimatedCompletion ? new Date(estimatedCompletion) : undefined, tasks: tasks ? { create: tasks.map((t) => ({ title: t, completed: false })) } : undefined, projectId: projectId ?? null },
        include: { tasks: true },
      })
      return { success: true, id: step.id, phase: step.phase, title: step.title, tasksCreated: step.tasks.length }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

export const updateRoadmapStep = tool({
  description: "Update an existing roadmap step. Use for marking milestones complete, updating progress, or changing priority after research findings.",
  inputSchema: z.object({
    id: z.string().describe("Roadmap step ID"),
    title: z.string().optional(), description: z.string().optional(),
    status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
    progressPercent: z.number().min(0).max(100).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    milestone: z.string().optional(),
  }),
  execute: async ({ id, ...updates }) => {
    try {
      const step = await prisma.roadmapStep.update({ where: { id }, data: updates })
      return { success: true, id: step.id, title: step.title, status: step.status, progressPercent: step.progressPercent }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

export const completeRoadmapTask = tool({
  description: "Mark a specific roadmap task as completed within a roadmap step.",
  inputSchema: z.object({ taskId: z.string().describe("The ID of the roadmap task to complete") }),
  execute: async ({ taskId }) => {
    try {
      const task = await prisma.roadmapTask.update({ where: { id: taskId }, data: { completed: true } })
      return { success: true, taskId: task.id, title: task.title }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 5 — EXPERIMENT PLANNING (existing, unchanged)
// ════════════════════════════════════════════════════════════════════════════════

export const createExperiment = tool({
  description: "Create a new ML experiment entry. Use for /experiment commands and experiment planning workflows. Include all relevant hyperparameters.",
  inputSchema: z.object({
    name: z.string().describe("Experiment name"),
    baseModel: z.string().describe("Base model (e.g. 'TinyLlama/TinyLlama-1.1B-Chat-v1.0')"),
    description: z.string().optional(),
    method: z.string().optional().describe("Training method (e.g. 'LoRA', 'QLoRA', 'full fine-tune', 'GRPO')"),
    loraRank: z.number().optional(), loraAlpha: z.number().optional(),
    batchSize: z.number().optional(), learningRate: z.number().optional(), epochs: z.number().optional(),
    datasetId: z.string().optional().describe("ID of the dataset to use"),
    config: z.record(z.string(), z.unknown()).optional().describe("Additional config as JSON"),
    projectId: z.string().optional().describe("Project ID to scope this experiment to"),
  }),
  execute: async ({ name, baseModel, description, method, loraRank, loraAlpha, batchSize, learningRate, epochs, datasetId, config, projectId }) => {
    try {
      const exp = await prisma.experiment.create({ data: { name, baseModel, description, method, status: "PENDING", loraRank, loraAlpha, batchSize, learningRate, epochs, datasetId, config: config as InputJsonValue | undefined, projectId: projectId ?? null } })
      return { success: true, id: exp.id, name: exp.name }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

export const updateExperiment = tool({
  description: "Update an existing experiment. Use to record results, update status, or add result summaries after analysis.",
  inputSchema: z.object({
    id: z.string(),
    name: z.string().optional(), description: z.string().optional(),
    status: z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
    resultSummary: z.string().optional(), evalLoss: z.number().optional(),
    evalAccuracy: z.number().optional(), bleuScore: z.number().optional(), pass1Score: z.number().optional(),
  }),
  execute: async ({ id, ...updates }) => {
    try {
      const exp = await prisma.experiment.update({ where: { id }, data: updates })
      return { success: true, id: exp.id, name: exp.name, status: exp.status }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 6 — DATASET INTELLIGENCE (existing, unchanged)
// ════════════════════════════════════════════════════════════════════════════════

export const createDataset = tool({
  description: "Create a new dataset entry in the lab. Use for /dataset commands and dataset intelligence workflows. Include full metadata.",
  inputSchema: z.object({
    name: z.string(), description: z.string().optional(),
    datasetType: z.enum(["CODE", "TEXT", "INSTRUCTION", "QA", "MIXED"]),
    numSamples: z.number().optional(), format: z.string().optional(),
    sourceUrl: z.string().optional(), tags: z.array(z.string()).optional(),
    license: z.string().optional(), projectId: z.string().optional(),
  }),
  execute: async ({ name, description, datasetType, numSamples, format, sourceUrl, tags, license, projectId }) => {
    try {
      const ds = await prisma.dataset.create({ data: { name, description, datasetType, numSamples, format, sourceUrl, tags: tags || [], license, preprocessStatus: "RAW", projectId: projectId ?? null } })
      return { success: true, id: ds.id, name: ds.name }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

export const updateDataset = tool({
  description: "Update an existing dataset. Use to update preprocessing status, add sample counts, or improve descriptions after dataset analysis.",
  inputSchema: z.object({
    id: z.string(), name: z.string().optional(), description: z.string().optional(),
    preprocessStatus: z.enum(["RAW", "CLEANING", "CLEANED", "FORMATTED", "AUGMENTED", "READY"]).optional(),
    numSamples: z.number().optional(), tags: z.array(z.string()).optional(), format: z.string().optional(),
  }),
  execute: async ({ id, ...updates }) => {
    try {
      const ds = await prisma.dataset.update({ where: { id }, data: updates })
      return { success: true, id: ds.id, name: ds.name }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

export const analyzeDatasetIntelligence = tool({
  description: "Analyze a dataset and produce intelligence: quality assessment, sample statistics, documentation, and experiment suggestions. This is the Dataset Intelligence automation workflow.",
  inputSchema: z.object({ datasetId: z.string().describe("ID of the dataset to analyze") }),
  execute: async ({ datasetId }) => {
    try {
      const ds = await prisma.dataset.findUnique({ where: { id: datasetId }, include: { experiments: { select: { id: true, name: true, status: true, baseModel: true } } } })
      if (!ds) return { error: "Dataset not found" }
      const relatedDocs = await prisma.documentationPage.findMany({ where: { OR: [{ title: { contains: ds.name, mode: "insensitive" } }, { tags: { hasSome: ds.tags } }] }, select: { id: true, title: true, slug: true }, take: 3 })
      return { dataset: { id: ds.id, name: ds.name, type: ds.datasetType, numSamples: ds.numSamples, format: ds.format, preprocessStatus: ds.preprocessStatus, tags: ds.tags, description: ds.description, license: ds.license }, linkedExperiments: ds.experiments, relatedDocumentation: relatedDocs, analysisContext: { hasExperiments: ds.experiments.length > 0, isReady: ds.preprocessStatus === "READY", sampleCount: ds.numSamples || "unknown" } }
    } catch (err) { return { error: String(err) } }
  },
})

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 7 — MODEL BENCHMARKING (existing, unchanged)
// ════════════════════════════════════════════════════════════════════════════════

export const benchmarkModel = tool({
  description: "Record benchmark results for a model version and generate a benchmark report. Use when a model has been evaluated. Creates a structured benchmark documentation page and updates model metrics.",
  inputSchema: z.object({
    modelVersionId: z.string().describe("ID of the ModelVersion to benchmark"),
    bleuScore: z.number().optional(), pass1Score: z.number().optional(),
    humanEval: z.number().optional(), mmluScore: z.number().optional(),
    benchmarkNotes: z.string().optional(),
    generateReport: z.boolean().optional().default(true),
  }),
  execute: async ({ modelVersionId, bleuScore, pass1Score, humanEval, mmluScore, benchmarkNotes, generateReport }) => {
    try {
      const model = await prisma.modelVersion.update({ where: { id: modelVersionId }, data: { bleuScore, pass1Score, humanEval, mmluScore } })
      let docResult = null
      if (generateReport) {
        const slug = `benchmark-${model.name.toLowerCase().replace(/\s+/g, "-")}-${model.version}-${Date.now()}`
        const reportContent = `# Benchmark Report: ${model.name} v${model.version}\n\n## Overview\nModel: **${model.name}** (version ${model.version})\nQuantization: ${model.quantization || "None"}\nDeployment Status: ${model.isDeployed ? "✅ Deployed" : "⏳ Not deployed"}\n\n## Benchmark Results\n\n| Metric | Score |\n|--------|-------|\n| BLEU Score | ${bleuScore !== undefined ? bleuScore.toFixed(2) : "N/A"} |\n| HumanEval pass@1 | ${pass1Score !== undefined ? pass1Score.toFixed(2) : "N/A"} |\n| Human Evaluation | ${humanEval !== undefined ? humanEval.toFixed(2) : "N/A"} |\n| MMLU | ${mmluScore !== undefined ? mmluScore.toFixed(2) : "N/A"} |\n\n## Analysis\n${benchmarkNotes || "No qualitative notes provided."}\n\nGenerated: ${new Date().toISOString()}`
        const doc = await prisma.documentationPage.create({ data: { title: `Benchmark: ${model.name} v${model.version}`, slug, section: "Benchmarks", content: reportContent, tags: ["benchmark", "model", model.name, model.version], order: 99, progress: "COMPLETED" } })
        docResult = { docId: doc.id, docSlug: doc.slug }
      }
      return { success: true, modelId: model.id, name: model.name, version: model.version, metrics: { bleuScore, pass1Score, humanEval, mmluScore }, report: docResult }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

export const getModelLeaderboard = tool({
  description: "Retrieve the model leaderboard sorted by benchmark metrics. Use this to rank models and compare performance.",
  inputSchema: z.object({
    sortBy: z.enum(["bleuScore", "pass1Score", "humanEval", "mmluScore"]).optional().default("pass1Score"),
    limit: z.number().int().min(1).max(20).optional().default(10),
  }),
  execute: async ({ sortBy = "pass1Score", limit = 10 }) => {
    try {
      const models = await prisma.modelVersion.findMany({
        where: { [sortBy]: { not: null } },
        select: { id: true, name: true, version: true, quantization: true, isDeployed: true, bleuScore: true, pass1Score: true, humanEval: true, mmluScore: true, parameterCount: true, createdAt: true, experiment: { select: { id: true, name: true, baseModel: true } } },
        orderBy: { [sortBy]: "desc" }, take: limit,
      })
      return { leaderboard: models, sortedBy: sortBy, total: models.length }
    } catch (err) { return { error: String(err) } }
  },
})

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 8 — WEB RESEARCH (existing, unchanged)
// ════════════════════════════════════════════════════════════════════════════════

export const crawlWeb = tool({
  description: "Fetch and read a specific known public web page for research purposes. Use to retrieve papers, documentation, GitHub READMEs, or current research from a KNOWN URL. For general research queries across the web, use the `research` tool instead. Limit to 2 URLs per turn.",
  inputSchema: z.object({ url: z.string().url().describe("Full HTTPS URL to fetch"), reason: z.string().optional().describe("Why you are fetching this URL") }),
  execute: async ({ url }) => {
    if (!isSafeUrl(url)) return { error: "Only HTTPS URLs to public hosts are allowed" }
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Prausdit-LabBot/2.0 (Research AI Assistant)", Accept: "text/html,text/plain,application/json,text/markdown" }, signal: AbortSignal.timeout(10000) })
      if (!res.ok) return { error: `HTTP ${res.status}: ${res.statusText}`, url }
      const contentType = res.headers.get("content-type") || ""
      const raw = await res.text()
      let text: string
      if (contentType.includes("application/json")) { try { text = JSON.stringify(JSON.parse(raw), null, 2).slice(0, 8000) } catch { text = raw.slice(0, 8000) } }
      else if (contentType.includes("text/plain") || contentType.includes("text/markdown")) { text = raw.slice(0, 8000) }
      else { text = stripHtml(raw) }
      const titleMatch = raw.match(/<title[^>]*>([^<]+)<\/title>/i)
      return { url, title: titleMatch ? titleMatch[1].trim() : url, content: text, length: text.length }
    } catch (err) { return { error: String(err), url } }
  },
})

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 9 — WORKFLOW ORCHESTRATION (existing, unchanged)
// ════════════════════════════════════════════════════════════════════════════════

export const runResearchAutopilot = tool({
  description: "Execute a full research autopilot workflow for a given topic. Performs knowledge graph search, identifies gaps, and returns a structured research plan with specific actions to take. Use for 'start research for X' commands.",
  inputSchema: z.object({
    topic: z.string().describe("Research topic"),
    scope: z.array(z.enum(["roadmap", "experiments", "datasets", "documentation", "notes"])).optional(),
  }),
  execute: async ({ topic, scope }) => {
    const targetScopes = scope || ["roadmap", "experiments", "datasets", "documentation", "notes"]
    try {
      const [experiments, datasets, docs, roadmapSteps] = await Promise.all([
        targetScopes.includes("experiments") ? prisma.experiment.findMany({ where: { OR: [{ name: { contains: topic, mode: "insensitive" } }, { description: { contains: topic, mode: "insensitive" } }] }, select: { id: true, name: true, status: true }, take: 5 }) : [],
        targetScopes.includes("datasets") ? prisma.dataset.findMany({ where: { OR: [{ name: { contains: topic, mode: "insensitive" } }, { description: { contains: topic, mode: "insensitive" } }] }, select: { id: true, name: true, datasetType: true }, take: 5 }) : [],
        targetScopes.includes("documentation") ? prisma.documentationPage.findMany({ where: { OR: [{ title: { contains: topic, mode: "insensitive" } }, { content: { contains: topic, mode: "insensitive" } }] }, select: { id: true, title: true, slug: true }, take: 5 }) : [],
        targetScopes.includes("roadmap") ? prisma.roadmapStep.findMany({ where: { OR: [{ title: { contains: topic, mode: "insensitive" } }, { description: { contains: topic, mode: "insensitive" } }] }, select: { id: true, title: true, status: true, phase: true }, take: 5 }) : [],
      ])
      return {
        topic,
        existingContext: {
          experiments: experiments.map((e: { id: string; name: string; status: string }) => ({ id: e.id, name: e.name, status: e.status })),
          datasets: datasets.map((d: { id: string; name: string; datasetType: string }) => ({ id: d.id, name: d.name, type: d.datasetType })),
          documentation: docs.map((d: { id: string; title: string; slug: string }) => ({ id: d.id, title: d.title, slug: d.slug })),
          roadmapSteps: roadmapSteps.map((r: { id: string; title: string; status: string; phase: number }) => ({ id: r.id, title: r.title, status: r.status, phase: r.phase })),
        },
        gaps: { needsExperiments: experiments.length === 0, needsDatasets: datasets.length === 0, needsDocumentation: docs.length === 0, needsRoadmapEntry: roadmapSteps.length === 0 },
        recommendation: `Based on existing context, focus on: ${[experiments.length === 0 ? "creating experiments" : "building on existing experiments", datasets.length === 0 ? "sourcing datasets" : "leveraging existing datasets", docs.length === 0 ? "writing documentation" : "updating documentation", roadmapSteps.length === 0 ? "adding roadmap entries" : "updating roadmap progress"].join(", ")}.`,
      }
    } catch (err) { return { error: String(err), topic } }
  },
})

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 10 — RESEARCH TOOL (NEW — unified deep research)
// ════════════════════════════════════════════════════════════════════════════════

export const researchTool = tool({
  description:
    "Perform deep web research on any topic. Searches multiple providers (Tavily → Brave → SerpAPI) with automatic fallback, then deep-crawls top results (Firecrawl → Crawl4AI → basic fetch). Returns structured results with snippets, full-page content, and sources. ALWAYS use this tool for external research — do NOT call crawl_web for research queries.",
  inputSchema: z.object({
    query: z.string().describe("Research query or question"),
    mode: z.enum(["deep", "quick"]).optional().default("deep").describe("'deep' = crawl top pages (richer, slower). 'quick' = snippets only (faster)."),
    maxCrawl: z.number().int().min(1).max(4).optional().default(2).describe("Max pages to deep-crawl when mode=deep"),
    saveAsNote: z.boolean().optional().default(false).describe("Auto-save results as a research note"),
    projectId: z.string().optional(),
  }),
  execute: async ({ query, mode, maxCrawl, saveAsNote, projectId }) => {
    try {
      const output = await deepResearch(query, { maxCrawl: maxCrawl ?? 2, crawlEnabled: mode !== "quick" })
      let noteResult: { id: string; title: string } | null = null
      if (saveAsNote && output.results.length > 0) {
        const noteContent = [
          `# Research: ${query}`, "",
          `**Provider:** ${output.provider} | **Crawled:** ${output.crawledCount} pages`, "",
          "## Summary", output.summary, "",
          "## Sources", ...output.sources.map((s, i) => `${i + 1}. ${s}`), "",
          "## Results",
          ...output.results.slice(0, 5).map((r) => [`### ${r.title}`, `URL: ${r.url}`, r.snippet, r.content ? `\n**Content:**\n${r.content.slice(0, 1500)}…` : ""].join("\n")),
        ].join("\n")
        try {
          const note = await prisma.note.create({ data: { title: `Research: ${query}`, content: noteContent, tags: ["research", "auto-saved"], pinned: false, projectId: projectId ?? null } })
          noteResult = { id: note.id, title: note.title }
        } catch { /* non-fatal */ }
      }
      return {
        query, provider: output.provider, crawlProvider: output.crawlProvider,
        crawledCount: output.crawledCount, resultCount: output.results.length,
        summary: output.summary, sources: output.sources,
        results: output.results.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet, content: r.content ? r.content.slice(0, 2000) : undefined, score: r.score })),
        savedNote: noteResult, error: output.error,
      }
    } catch (err) { return { query, error: String(err), results: [], sources: [] } }
  },
})

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 11 — PLANNING TOOLS (NEW — human-in-the-loop)
// ════════════════════════════════════════════════════════════════════════════════

export const generatePlan = tool({
  description:
    "Generate a structured execution plan and present it to the user for approval BEFORE doing any work. ALWAYS use this for complex multi-step tasks (creating roadmaps, bulk documents, research workflows, etc.). Plan includes: overview, sections with subheadings, action steps, optional image plan, and sources. DO NOT execute anything until plan is approved.",
  inputSchema: z.object({
    title: z.string().describe("Short plan title"),
    overview: z.string().describe("1-2 sentence summary of what this plan achieves"),
    sections: z.array(z.object({
      heading:       z.string(),
      subheading:    z.string().optional(),
      description:   z.string().describe("What this section covers and why"),
      steps:         z.array(z.string()).describe("Concrete action steps"),
      toolsRequired: z.array(z.string()).optional().describe("Agent tools needed in this section"),
    })).min(2).describe("Plan sections — at least 2 required"),
    imagePlan: z.object({
      needed:      z.boolean(),
      description: z.string().optional(),
    }).optional().describe("Image plan — only if images genuinely add value"),
    sources: z.array(z.object({ title: z.string(), url: z.string() })).optional(),
    estimatedSteps: z.number().int().optional().describe("Estimated total tool calls"),
    projectId:   z.string().optional(),
    requestedBy: z.string().optional().describe("Original user request text"),
  }),
  execute: async ({ title, overview, sections, imagePlan, sources, estimatedSteps, projectId, requestedBy }) => {
    try {
      const planContent = buildPlanMarkdown(title, overview, sections, sources, imagePlan)
      const note = await prisma.note.create({
        data: { title: `📋 PLAN: ${title}`, content: planContent, tags: ["agent-plan", "pending-approval"], pinned: true, projectId: projectId ?? null },
      })
      return {
        success: true, planId: note.id, title, overview,
        sections: sections.map((s) => ({ heading: s.heading, subheading: s.subheading, stepsCount: s.steps.length, toolsRequired: s.toolsRequired })),
        imagePlan, sources, estimatedSteps, status: "PENDING_APPROVAL",
        requestedBy,
        message: `✅ Plan ready (Note ID: \`${note.id}\`). Review the plan above and reply **approve** to execute, or give feedback to refine.`,
      }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

export const updatePlan = tool({
  description: "Refine or update an existing plan based on user feedback. Use when user says 'change X', 'add section for Y', etc. Updates the plan note and awaits re-approval.",
  inputSchema: z.object({
    planNoteId:  z.string().describe("Note ID of the plan to update (from generate_plan)"),
    changes:     z.string().describe("What was changed and why"),
    newTitle:    z.string().optional(),
    newOverview: z.string().optional(),
    newSections: z.array(z.object({ heading: z.string(), subheading: z.string().optional(), description: z.string(), steps: z.array(z.string()), toolsRequired: z.array(z.string()).optional() })).optional(),
    newSources:  z.array(z.object({ title: z.string(), url: z.string() })).optional(),
  }),
  execute: async ({ planNoteId, changes, newTitle, newOverview, newSections, newSources }) => {
    try {
      const existing = await prisma.note.findUnique({ where: { id: planNoteId } })
      if (!existing) return { success: false, error: `Plan note ${planNoteId} not found` }
      const title    = newTitle    || existing.title.replace("📋 PLAN: ", "").replace("📋 PLAN (REVISED): ", "")
      const overview = newOverview || ""
      const sections = newSections || []
      const updatedContent = buildPlanMarkdown(title, overview, sections, newSources ?? []) + `\n\n---\n**Revision:** ${changes}\n**Updated:** ${new Date().toISOString()}`
      const updated = await prisma.note.update({ where: { id: planNoteId }, data: { title: `📋 PLAN (REVISED): ${title}`, content: updatedContent, tags: ["agent-plan", "revised", "pending-approval"] } })
      return { success: true, planNoteId: updated.id, title, changes, status: "PENDING_APPROVAL", message: `Plan revised. Changes: ${changes}. Reply **approve** to proceed.` }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

export const approvePlan = tool({
  description: "Record that a plan has been approved by the user. Call ONLY when user explicitly says 'approve', 'yes proceed', 'go ahead'. After this, proceed with execution using CRM tools.",
  inputSchema: z.object({
    planNoteId:  z.string().describe("Note ID of the approved plan"),
    approvedBy:  z.string().optional().describe("Name/identifier of who approved"),
  }),
  execute: async ({ planNoteId, approvedBy }) => {
    try {
      const note = await prisma.note.findUnique({ where: { id: planNoteId } })
      if (!note) return { success: false, error: `Plan note ${planNoteId} not found` }
      await prisma.note.update({
        where: { id: planNoteId },
        data: {
          title:   note.title.replace("📋 PLAN:", "✅ APPROVED:").replace("(REVISED):", "(APPROVED):"),
          content: note.content + `\n\n---\n✅ **APPROVED** by ${approvedBy || "user"} at ${new Date().toISOString()}`,
          tags:    ["agent-plan", "approved"], pinned: false,
        },
      })
      return { success: true, planNoteId, status: "APPROVED", message: "Plan approved. Proceeding with execution...", approvedBy: approvedBy || "user", approvedAt: new Date().toISOString() }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

export const finalizeExecution = tool({
  description: "Record the completion of a plan execution. Call AFTER all plan steps have been executed. Summarises what was created, stores a completion report, and uploads images to Cloudinary if configured.",
  inputSchema: z.object({
    planNoteId:      z.string().optional().describe("Plan Note ID this execution was for"),
    executionTitle:  z.string().describe("Title for the execution report"),
    summary:         z.string().describe("What was accomplished — list created entities with IDs"),
    createdEntities: z.array(z.object({ type: z.enum(["document", "note", "experiment", "dataset", "roadmap_step", "model"]), id: z.string(), title: z.string() })).optional(),
    imageUrls:       z.array(z.string()).optional().describe("Raw image URLs to upload to Cloudinary"),
    projectId:       z.string().optional(),
  }),
  execute: async ({ planNoteId, executionTitle, summary, createdEntities, imageUrls, projectId }) => {
    try {
      const cloudinaryResults: Array<{ original: string; cloudinaryUrl: string }> = []
      if (imageUrls && imageUrls.length > 0 && isCloudinaryConfigured()) {
        for (const url of imageUrls.slice(0, 4)) {
          const result = await downloadAndUpload(url, { folder: "prausdit-lab/agent-generated", tags: ["agent-generated"] })
          if (result) cloudinaryResults.push({ original: url, cloudinaryUrl: result.url })
        }
      }
      const reportLines = [
        `# ✅ Execution Complete: ${executionTitle}`, "",
        `**Completed:** ${new Date().toISOString()}`,
        planNoteId ? `**Plan ID:** ${planNoteId}` : "", "",
        "## Summary", summary,
      ]
      if (createdEntities?.length) { reportLines.push("", "## Created Entities"); createdEntities.forEach((e) => reportLines.push(`- **${e.type}**: ${e.title} (ID: \`${e.id}\`)`)) }
      if (cloudinaryResults.length) { reportLines.push("", "## Uploaded Images (Cloudinary)"); cloudinaryResults.forEach((r) => { reportLines.push(`- ![](${r.cloudinaryUrl})`); reportLines.push(`  CDN: ${r.cloudinaryUrl}`) }) }
      const reportNote = await prisma.note.create({ data: { title: `✅ DONE: ${executionTitle}`, content: reportLines.filter(Boolean).join("\n"), tags: ["execution-report", "completed"], pinned: false, projectId: projectId ?? null } })
      if (planNoteId) { try { await prisma.note.update({ where: { id: planNoteId }, data: { tags: ["agent-plan", "executed"], pinned: false } }) } catch { /* non-fatal */ } }
      return { success: true, reportNoteId: reportNote.id, executionTitle, createdEntities: createdEntities || [], cloudinaryUploads: cloudinaryResults, message: `Execution complete. Report saved (Note ID: ${reportNote.id}).` }
    } catch (err) { return { success: false, error: String(err) } }
  },
})

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 12 — CLOUDINARY IMAGE UPLOAD (NEW)
// ════════════════════════════════════════════════════════════════════════════════

export const uploadImage = tool({
  description: "Upload an image from a URL to Cloudinary CDN and return the permanent CDN URL. Use when you have a generated or downloaded image that needs persistent storage. Returns a Cloudinary HTTPS URL for use in documents and notes.",
  inputSchema: z.object({
    imageUrl: z.string().url().describe("HTTPS URL of the image to upload"),
    filename: z.string().optional().describe("Filename/public_id for the image"),
    folder:   z.string().optional().describe("Cloudinary folder (default: prausdit-lab)"),
    tags:     z.array(z.string()).optional(),
  }),
  execute: async ({ imageUrl, filename, folder, tags }) => {
    if (!imageUrl.startsWith("https://")) return { success: false, error: "Only HTTPS URLs allowed" }
    if (!isCloudinaryConfigured()) return { success: false, error: "Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET.", fallback: imageUrl }
    try {
      const result = await downloadAndUpload(imageUrl, { filename, folder, tags })
      if (!result) return { success: false, error: "Upload failed", fallback: imageUrl }
      return { success: true, cloudinaryUrl: result.url, publicId: result.publicId, width: result.width, height: result.height, bytes: result.bytes, message: `Image uploaded: ${result.url}` }
    } catch (err) { return { success: false, error: String(err), fallback: imageUrl } }
  },
})

// ════════════════════════════════════════════════════════════════════════════════
// TOOL REGISTRY — single source of truth
// ════════════════════════════════════════════════════════════════════════════════

export const agentTools = {
  // ── Knowledge & RAG ─────────────────────────────────────────────────────────
  search_internal_docs:   searchInternalDocs,
  get_knowledge_graph:    getKnowledgeGraph,
  // ── Documentation ───────────────────────────────────────────────────────────
  read_document:          readDocument,
  create_document:        createDocument,
  update_document:        updateDocument,
  // ── Research Notes ──────────────────────────────────────────────────────────
  create_note:            createNote,
  update_note:            updateNote,
  // ── Roadmap Autopilot ────────────────────────────────────────────────────────
  create_roadmap_step:    createRoadmapStep,
  update_roadmap_step:    updateRoadmapStep,
  complete_roadmap_task:  completeRoadmapTask,
  // ── Experiment Planning ──────────────────────────────────────────────────────
  create_experiment:      createExperiment,
  update_experiment:      updateExperiment,
  // ── Dataset Intelligence ─────────────────────────────────────────────────────
  create_dataset:         createDataset,
  update_dataset:         updateDataset,
  analyze_dataset:        analyzeDatasetIntelligence,
  // ── Model Benchmarking ───────────────────────────────────────────────────────
  benchmark_model:        benchmarkModel,
  get_model_leaderboard:  getModelLeaderboard,
  // ── Web Research ─────────────────────────────────────────────────────────────
  crawl_web:              crawlWeb,
  // ── Workflow Orchestration ───────────────────────────────────────────────────
  run_research_autopilot: runResearchAutopilot,
  // ── NEW: Deep Research ───────────────────────────────────────────────────────
  research:               researchTool,
  // ── NEW: Planning (Human-in-the-Loop) ───────────────────────────────────────
  generate_plan:          generatePlan,
  update_plan:            updatePlan,
  approve_plan:           approvePlan,
  finalize_execution:     finalizeExecution,
  // ── NEW: Cloudinary Image Upload ─────────────────────────────────────────────
  upload_image:           uploadImage,
} as const

export type AgentToolName = keyof typeof agentTools
