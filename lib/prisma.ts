/**
 * lib/prisma.ts — Prisma ORM v7 singleton for Vercel + any PostgreSQL provider
 * ─────────────────────────────────────────────────────────────────────────────
 * Compatible with ALL standard PostgreSQL providers out of the box:
 *
 *   Provider          | Example URL sslmode
 *   ─────────────────────────────────────────────────────────────────────────
 *   NeonDB            | ...?sslmode=require
 *   Nile (thenile.dev)| ...?sslmode=require
 *   Supabase          | ...?sslmode=require  (pooled: add &pgbouncer=true)
 *   Railway           | ...?sslmode=require
 *   Aiven             | ...?sslmode=require
 *   Render            | ...?sslmode=require
 *   AWS RDS           | ...?sslmode=require  (or verify-full with CA cert)
 *   Azure PostgreSQL  | ...?sslmode=require
 *   Google Cloud SQL  | ...?sslmode=require
 *   CockroachDB       | ...?sslmode=verify-full
 *   Local / Docker    | (no sslmode param, or ?sslmode=disable)
 *
 * SSL is driven entirely by the sslmode query parameter in your DATABASE_URL.
 * No provider-specific hacks required — just set the right URL and it works.
 *
 * sslmode behaviour (matches PostgreSQL libpq semantics):
 *   disable     → no SSL at all  (local dev, Docker)
 *   allow       → try plain, fallback to SSL
 *   prefer      → try SSL, fallback to plain  ← default when sslmode absent
 *   require     → SSL required, cert NOT verified  ← most cloud providers
 *   verify-ca   → SSL + verify server cert against CA
 *   verify-full → SSL + verify cert + verify hostname
 *
 * Prisma v7 notes:
 *   - Import path: generated/prisma/client  (explicit output in schema.prisma)
 *   - URL / directUrl live in prisma.config.ts, NOT the schema datasource block
 *   - We use @prisma/adapter-pg for the pg driver adapter
 *
 * Connection priority: DATABASE_URL → POSTGRES_URL → POSTGRES_PRISMA_URL
 * (DATABASE_URL is checked first because Nile and Railway set that one)
 */

// ─── Lazy type references (avoids import-before-generate errors) ──────────────

let PrismaClient: typeof import("../generated/prisma").PrismaClient
let PrismaPg: typeof import("@prisma/adapter-pg").PrismaPg

// ─── Exported types ───────────────────────────────────────────────────────────

export type PrismaClientType = import("../generated/prisma").PrismaClient

// ─── URL resolution ───────────────────────────────────────────────────────────

function getDatabaseUrl(): string | null {
  // DATABASE_URL first — used by Nile, Railway, Render, and most providers
  // POSTGRES_URL / POSTGRES_PRISMA_URL — used by Vercel Postgres, Supabase integrations
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    null
  )
}

const DATABASE_URL = getDatabaseUrl()
const IS_DATABASE_CONFIGURED = !!DATABASE_URL

// ─── SSL config derived from sslmode in the URL ───────────────────────────────

/**
 * Builds a pg-compatible ssl config object (or false/undefined) by reading the
 * sslmode query parameter from the connection URL.
 *
 * We intentionally do NOT pass a connectionString to PrismaPg because doing so
 * lets the pg driver re-parse the URL's sslmode and override whatever ssl object
 * we set — a confirmed Prisma/pg interaction bug. Instead we parse the URL once
 * here and pass individual fields so our ssl config is the sole authority.
 */
function buildSslConfig(
  sslmode: string | null
): false | { rejectUnauthorized: boolean } | undefined {
  switch (sslmode) {
    case "disable":
      // No SSL at all — local Postgres, Docker, etc.
      return false

    case "allow":
    case "prefer":
      // Try SSL but don't require it and don't verify the cert.
      // pg doesn't have a native "try ssl, fallback to plain" mode, so we
      // enable SSL without cert verification which is the closest match.
      return { rejectUnauthorized: false }

    case "require":
      // SSL required, server certificate NOT verified against a CA.
      // This is what Neon, Nile, Supabase, Railway, Render, Aiven etc. all use.
      return { rejectUnauthorized: false }

    case "verify-ca":
    case "verify-full":
      // SSL required AND server certificate verified against system CA store.
      // Used by CockroachDB, AWS RDS with full cert verification, etc.
      // Node's tls module uses the OS trust store automatically when
      // rejectUnauthorized: true, so no ca file is needed in most cases.
      return { rejectUnauthorized: true }

    default:
      // sslmode param not present in URL.
      // Default: try SSL with no cert verification (matches "prefer" semantics
      // and works for all major cloud providers without extra config).
      return { rejectUnauthorized: false }
  }
}

// ─── Build pg PoolConfig from URL (no connectionString) ──────────────────────

function buildPoolConfig(): Record<string, unknown> {
  if (!DATABASE_URL) {
    throw new Error(
      "[Prisma] No database URL configured. " +
        "Set DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL) in your environment."
    )
  }

  let parsed: URL
  try {
    parsed = new URL(DATABASE_URL)
  } catch {
    throw new Error(
      `[Prisma] DATABASE_URL is not a valid URL: "${DATABASE_URL.slice(0, 60)}…"\n` +
        "  Expected format: postgresql://user:password@host:5432/dbname?sslmode=require"
    )
  }

  const sslmode = parsed.searchParams.get("sslmode")
  const ssl = buildSslConfig(sslmode)

  const config: Record<string, unknown> = {
    host:     parsed.hostname,
    port:     parsed.port ? Number(parsed.port) : 5432,
    user:     decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, "") || "postgres",
    // 1 connection per serverless function instance prevents pool exhaustion.
    // Increase this only if you are running a long-lived Node.js server.
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis:       30_000,
  }

  // Only attach ssl key if SSL is needed (false = explicitly disabled)
  if (ssl !== undefined) {
    config.ssl = ssl === false ? false : ssl
  }

  return config
}

// ─── Availability check ───────────────────────────────────────────────────────

let PRISMA_CLIENT_AVAILABLE = false
try {
  require.resolve("../generated/prisma")
  PRISMA_CLIENT_AVAILABLE = true
} catch {
  console.warn(
    "[Prisma] Generated client not found at ../generated/prisma.\n" +
      "  Run 'npx prisma generate' to create it. This is expected before the first build."
  )
}

// ─── Client factory ───────────────────────────────────────────────────────────

function createPrismaClient(): PrismaClientType {
  if (!PRISMA_CLIENT_AVAILABLE) {
    throw new Error(
      "[Prisma] Generated client not found. Run 'npx prisma generate' first."
    )
  }

  if (!PrismaClient) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("../generated/prisma")
    PrismaClient = mod.PrismaClient
  }
  if (!PrismaPg) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@prisma/adapter-pg")
    PrismaPg = mod.PrismaPg
  }

  const poolConfig = buildPoolConfig()

  if (process.env.NODE_ENV === "development") {
    const maskedConfig = {
      ...poolConfig,
      password: poolConfig.password ? "****" : undefined,
    }
    console.log("[Prisma] Creating client with config:", JSON.stringify(maskedConfig))
  }

  return new PrismaClient({
    adapter: new PrismaPg(
      poolConfig as ConstructorParameters<typeof PrismaPg>[0]
    ),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })
}

// ─── Fallback stub (no DB configured) ────────────────────────────────────────

function createStubClient(): PrismaClientType {
  const reason = !IS_DATABASE_CONFIGURED
    ? "No database URL configured. Set DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL)."
    : "Generated Prisma client not found. Run 'npx prisma generate' first."

  return new Proxy({} as PrismaClientType, {
    get(_target, prop) {
      // Allow promise-like access without throwing
      if (prop === "then" || prop === "catch" || prop === "finally") {
        return undefined
      }
      if (typeof prop === "string" && !prop.startsWith("_")) {
        return new Proxy(() => {}, {
          get() {
            throw new Error(`[Prisma] ${reason} Cannot access prisma.${prop}.`)
          },
          apply() {
            throw new Error(`[Prisma] ${reason} Cannot call prisma.${prop}().`)
          },
        })
      }
      return undefined
    },
  })
}

// ─── Singleton ────────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined
}

function getPrismaClient(): PrismaClientType {
  if (!IS_DATABASE_CONFIGURED || !PRISMA_CLIENT_AVAILABLE) {
    return createStubClient()
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

export const prisma: PrismaClientType = getPrismaClient()

// In production each serverless invocation gets a fresh module, so caching in
// globalThis is only meaningful during development (hot-reload prevention).
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Returns true when the database URL is set AND the generated client exists. */
export function isDatabaseConfigured(): boolean {
  return IS_DATABASE_CONFIGURED && PRISMA_CLIENT_AVAILABLE
}

/**
 * Wraps a database operation and returns null instead of throwing when the
 * database is not configured. Useful for optional DB features in dev mode.
 *
 * @example
 * const user = await withDatabase(() => prisma.user.findUnique({ where: { id } }))
 */
export async function withDatabase<T>(
  operation: () => Promise<T>
): Promise<T | null> {
  if (!IS_DATABASE_CONFIGURED) {
    console.warn(
      "[Prisma] Database operation skipped — no database URL configured. " +
        "Set DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL) to enable database features."
    )
    return null
  }
  return operation()
    }
    
