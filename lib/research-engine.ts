/**
 * Prausdit Research Lab — Research Engine v2
 *
 * NEW ABSTRACTION LAYER — does NOT replace existing tools.
 * Wraps external search + crawl providers behind a single `deepResearch()` call.
 * The agent ONLY calls the `research` tool; this engine handles fallbacks internally.
 *
 * Search provider chain:  Tavily → Brave → SerpAPI
 * Crawl provider chain:   Firecrawl → Crawl4AI → Playwright-style fetch
 *
 * All results are normalised into ResearchResult[].
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResearchResult {
  title: string
  url: string
  snippet: string
  content?: string   // full extracted text (from crawl)
  source: string     // which provider supplied this
  score?: number     // relevance score where available
}

export interface DeepResearchOutput {
  query: string
  results: ResearchResult[]
  summary: string
  sources: string[]
  provider: string          // which search provider succeeded
  crawlProvider?: string    // which crawl provider succeeded (if any)
  crawledCount: number
  error?: string
}

// ─── Config (resolved at call-time from environment) ─────────────────────────

function getConfig() {
  return {
    tavily:    process.env.TAVILY_API_KEY    || null,
    brave:     process.env.BRAVE_API_KEY     || null,
    serpapi:   process.env.SERPAPI_KEY       || null,
    firecrawl: process.env.FIRECRAWL_API_KEY || null,
    crawl4ai:  process.env.CRAWL4AI_API_URL  || null,   // base URL of self-hosted instance
  }
}

// ─── Security: block SSRF targets ─────────────────────────────────────────────

const BLOCKED_HOSTS = [
  "localhost", "127.0.0.1", "0.0.0.0",
  "169.254.169.254", "metadata.google", "instance-data",
  "192.168.", "10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.",
  "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.",
  "172.28.", "172.29.", "172.30.", "172.31.", "::1",
]

function isSafeUrl(url: string): boolean {
  if (!url.startsWith("https://")) return false
  return !BLOCKED_HOSTS.some((h) => url.includes(h))
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 6000)
}

function truncate(text: string, maxLen = 4000): string {
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text
}

// ─── Search Providers ─────────────────────────────────────────────────────────

/** Tavily — primary search provider */
async function searchTavily(
  query: string,
  config: ReturnType<typeof getConfig>
): Promise<ResearchResult[] | null> {
  if (!config.tavily) return null
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.tavily,
        query,
        search_depth: "advanced",
        max_results: 6,
        include_answer: false,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.results || []).map((r: { title?: string; url: string; content?: string; score?: number }) => ({
      title:   r.title || r.url,
      url:     r.url,
      snippet: r.content || "",
      source:  "tavily",
      score:   r.score,
    }))
  } catch {
    return null
  }
}

/** Brave Search — fallback provider */
async function searchBrave(
  query: string,
  config: ReturnType<typeof getConfig>
): Promise<ResearchResult[] | null> {
  if (!config.brave) return null
  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6`
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": config.brave,
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const webResults = data.web?.results || []
    return webResults.map((r: { title: string; url: string; description?: string }) => ({
      title:   r.title,
      url:     r.url,
      snippet: r.description || "",
      source:  "brave",
    }))
  } catch {
    return null
  }
}

/** SerpAPI — final fallback provider */
async function searchSerpApi(
  query: string,
  config: ReturnType<typeof getConfig>
): Promise<ResearchResult[] | null> {
  if (!config.serpapi) return null
  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=6&api_key=${config.serpapi}`
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) return null
    const data = await res.json()
    const organic = data.organic_results || []
    return organic.map((r: { title: string; link: string; snippet?: string }) => ({
      title:   r.title,
      url:     r.link,
      snippet: r.snippet || "",
      source:  "serpapi",
    }))
  } catch {
    return null
  }
}

/** Chain: try each provider in order, return first success */
async function searchWithFallback(
  query: string
): Promise<{ results: ResearchResult[]; provider: string }> {
  const cfg = getConfig()

  const tavily = await searchTavily(query, cfg)
  if (tavily && tavily.length > 0) return { results: tavily, provider: "tavily" }

  const brave = await searchBrave(query, cfg)
  if (brave && brave.length > 0) return { results: brave, provider: "brave" }

  const serp = await searchSerpApi(query, cfg)
  if (serp && serp.length > 0) return { results: serp, provider: "serpapi" }

  // Final fallback: no external search keys — return empty with warning
  return { results: [], provider: "none" }
}

// ─── Crawl Providers ──────────────────────────────────────────────────────────

/** Firecrawl — primary crawl provider (managed API) */
async function crawlFirecrawl(
  url: string,
  config: ReturnType<typeof getConfig>
): Promise<string | null> {
  if (!config.firecrawl) return null
  if (!isSafeUrl(url)) return null
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.firecrawl}`,
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.markdown ? truncate(data.data.markdown) : null
  } catch {
    return null
  }
}

/** Crawl4AI — self-hosted fallback (open source) */
async function crawlCrawl4AI(
  url: string,
  config: ReturnType<typeof getConfig>
): Promise<string | null> {
  if (!config.crawl4ai) return null
  if (!isSafeUrl(url)) return null
  try {
    const res = await fetch(`${config.crawl4ai}/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: [url], word_count_threshold: 50 }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const result = Array.isArray(data.results) ? data.results[0] : data
    return result?.markdown ? truncate(result.markdown) : null
  } catch {
    return null
  }
}

/** Basic fetch fallback — strip HTML, no JS rendering */
async function crawlBasicFetch(url: string): Promise<string | null> {
  if (!isSafeUrl(url)) return null
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Prausdit-LabBot/2.0 (Research AI; +https://prausdit.app)",
        "Accept": "text/html,text/plain,text/markdown",
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const ct = res.headers.get("content-type") || ""
    const raw = await res.text()
    if (ct.includes("text/plain") || ct.includes("text/markdown")) return truncate(raw)
    return truncate(stripHtml(raw))
  } catch {
    return null
  }
}

/** Chain: try each crawl provider in order */
async function crawlWithFallback(
  url: string
): Promise<{ content: string | null; provider: string }> {
  const cfg = getConfig()

  const fc = await crawlFirecrawl(url, cfg)
  if (fc) return { content: fc, provider: "firecrawl" }

  const c4 = await crawlCrawl4AI(url, cfg)
  if (c4) return { content: c4, provider: "crawl4ai" }

  const basic = await crawlBasicFetch(url)
  if (basic) return { content: basic, provider: "basic-fetch" }

  return { content: null, provider: "none" }
}

// ─── Summary Builder ──────────────────────────────────────────────────────────

function buildSummary(
  query: string,
  results: ResearchResult[],
  provider: string
): string {
  if (results.length === 0) {
    return `No external search results found for "${query}". No search API keys are configured (TAVILY_API_KEY, BRAVE_API_KEY, SERPAPI_KEY). Using internal knowledge base only.`
  }

  const snippets = results
    .slice(0, 4)
    .map((r, i) => `${i + 1}. **${r.title}** — ${r.snippet.slice(0, 200)}`)
    .join("\n")

  return `Found ${results.length} results via ${provider} for "${query}":\n\n${snippets}`
}

// ─── Main Export: deepResearch ────────────────────────────────────────────────

/**
 * Unified research function used by the `research` agent tool.
 *
 * Flow:
 *   1. Search (Tavily → Brave → SerpAPI)
 *   2. Crawl top N URLs (Firecrawl → Crawl4AI → basic fetch)
 *   3. Merge snippet + crawled content
 *   4. Return structured output
 */
export async function deepResearch(
  query: string,
  options: {
    maxCrawl?: number          // how many URLs to deep-crawl (default 2)
    crawlEnabled?: boolean     // set false to skip crawling (faster)
  } = {}
): Promise<DeepResearchOutput> {
  const { maxCrawl = 2, crawlEnabled = true } = options

  try {
    // Step 1: Search
    const { results: searchResults, provider } = await searchWithFallback(query)

    if (searchResults.length === 0) {
      return {
        query,
        results: [],
        summary: buildSummary(query, [], provider),
        sources: [],
        provider,
        crawledCount: 0,
        error: provider === "none"
          ? "No search API keys configured. Set TAVILY_API_KEY, BRAVE_API_KEY, or SERPAPI_KEY."
          : undefined,
      }
    }

    // Step 2: Crawl top results
    let crawlProvider: string | undefined
    let crawledCount = 0

    if (crawlEnabled) {
      const urlsToCrawl = searchResults
        .filter((r) => isSafeUrl(r.url))
        .slice(0, maxCrawl)

      for (const result of urlsToCrawl) {
        const { content, provider: cp } = await crawlWithFallback(result.url)
        if (content) {
          result.content = content
          crawlProvider = cp
          crawledCount++
        }
      }
    }

    // Step 3: Build output
    const sources = [...new Set(searchResults.map((r) => r.url))]
    const summary = buildSummary(query, searchResults, provider)

    return {
      query,
      results: searchResults,
      summary,
      sources,
      provider,
      crawlProvider,
      crawledCount,
    }
  } catch (err) {
    return {
      query,
      results: [],
      summary: `Research failed: ${String(err)}`,
      sources: [],
      provider: "error",
      crawledCount: 0,
      error: String(err),
    }
  }
}

// ─── Quick search (no crawl) ──────────────────────────────────────────────────

/** Lightweight search without page crawling. Faster, fewer tokens. */
export async function quickSearch(
  query: string
): Promise<DeepResearchOutput> {
  return deepResearch(query, { crawlEnabled: false })
}
