/**
 * lib/prisma.ts
 * Prisma ORM v7 singleton - works with any PostgreSQL provider.
 *
 * SSL is controlled by the sslmode param in your DATABASE_URL:
 *   sslmode=disable     -> no SSL (local/Docker)
 *   sslmode=require     -> SSL, no cert verification (NeonDB, Nile, Supabase, Railway, etc.)
 *   sslmode=verify-full -> SSL + full cert verification (CockroachDB, strict AWS RDS)
 *   (absent)            -> tries SSL without cert verification (safe default for cloud)
 *
 * URL priority: DATABASE_URL -> POSTGRES_URL -> POSTGRES_PRISMA_URL
 */

let PrismaClient: typeof import("../generated/prisma/client").PrismaClient
let PrismaPg: typeof import("@prisma/adapter-pg").PrismaPg

export type PrismaClientType = import("../generated/prisma/client").PrismaClient

function getDatabaseUrl(): string | null {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    null
  )
}

const DATABASE_URL = getDatabaseUrl()
const IS_DATABASE_CONFIGURED = !!DATABASE_URL

function buildSslConfig(
  sslmode: string | null
): false | { rejectUnauthorized: boolean } | undefined {
  switch (sslmode) {
    case "disable":
      return false
    case "allow":
    case "prefer":
    case "require":
      return { rejectUnauthorized: false }
    case "verify-ca":
    case "verify-full":
      return { rejectUnauthorized: true }
    default:
      // No sslmode in URL: default to SSL without cert verification.
      // Works for all major cloud providers without extra config.
      return { rejectUnauthorized: false }
  }
}

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
      "[Prisma] DATABASE_URL is not a valid URL: \"" + DATABASE_URL.slice(0, 60) + "...\"\n" +
        "  Expected format: postgresql://user:password@host:5432/dbname?sslmode=require"
    )
  }

  const sslmode = parsed.searchParams.get("sslmode")
  const ssl = buildSslConfig(sslmode)

  const config: Record<string, unknown> = {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, "") || "postgres",
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  }

  if (ssl !== undefined) {
    config.ssl = ssl
  }

  return config
}

let PRISMA_CLIENT_AVAILABLE = false
try {
  require.resolve("../generated/prisma/client")
  PRISMA_CLIENT_AVAILABLE = true
} catch {
  console.warn(
    "[Prisma] Generated client not found at ../generated/prisma/client. " +
      "Run 'npx prisma generate' to create it."
  )
}

function createPrismaClient(): PrismaClientType {
  if (!PRISMA_CLIENT_AVAILABLE) {
    throw new Error(
      "[Prisma] Generated client not found. Run 'npx prisma generate' first."
    )
  }

  if (!PrismaClient) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("../generated/prisma/client")
    PrismaClient = mod.PrismaClient
  }
  if (!PrismaPg) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@prisma/adapter-pg")
    PrismaPg = mod.PrismaPg
  }

  const poolConfig = buildPoolConfig()

  if (process.env.NODE_ENV === "development") {
    const masked = { ...poolConfig, password: poolConfig.password ? "****" : undefined }
    console.log("[Prisma] Creating client:", JSON.stringify(masked))
  }

  return new PrismaClient({
    adapter: new PrismaPg(poolConfig as ConstructorParameters<typeof PrismaPg>[0]),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })
}

function createStubClient(): PrismaClientType {
  const reason = !IS_DATABASE_CONFIGURED
    ? "No database URL configured. Set DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL)."
    : "Generated Prisma client not found. Run 'npx prisma generate' first."

  return new Proxy({} as PrismaClientType, {
    get(_target, prop) {
      if (prop === "then" || prop === "catch" || prop === "finally") return undefined
      if (typeof prop === "string" && !prop.startsWith("_")) {
        return new Proxy(() => {}, {
          get() {
            throw new Error("[Prisma] " + reason + " Cannot access prisma." + String(prop) + ".")
          },
          apply() {
            throw new Error("[Prisma] " + reason + " Cannot call prisma." + String(prop) + "().")
          },
        })
      }
      return undefined
    },
  })
}

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

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

export function isDatabaseConfigured(): boolean {
  return IS_DATABASE_CONFIGURED && PRISMA_CLIENT_AVAILABLE
}

export async function withDatabase<T>(
  operation: () => Promise<T>
): Promise<T | null> {
  if (!IS_DATABASE_CONFIGURED) {
    console.warn(
      "[Prisma] Database operation skipped - no database URL configured. " +
        "Set DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL) to enable database features."
    )
    return null
  }
  return operation()
}
