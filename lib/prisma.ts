/**
 * lib/prisma.ts
 * -------------
 * Singleton Prisma Client for Vercel serverless environments.
 * Prisma ORM v7 — imports from generated output path, NOT @prisma/client.
 *
 * Connection string priority (runtime):
 *   1. POSTGRES_PRISMA_URL  — Vercel Postgres / Supabase pooled URL (recommended)
 *   2. POSTGRES_URL         — Vercel Postgres alias
 *   3. DATABASE_URL         — direct connection fallback
 *
 * SSL: rejectUnauthorized:false accepts self-signed certs (Supabase, Aiven, Neon).
 * max:1 limits connections per serverless function instance.
 *
 * Note: prisma.config.ts handles the URL for CLI commands (migrations).
 *       This file handles the URL for runtime queries.
 */

// v7: Import from generated output path (defined by `output` in schema.prisma generator)
import { PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

function getConnectionString(): string {
  const url =
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim()

  if (!url) {
    throw new Error(
      "No database URL found. Set POSTGRES_PRISMA_URL, POSTGRES_URL, or DATABASE_URL."
    )
  }

  // Inject sslmode=no-verify if no SSL param is present.
  // Resolves "self-signed certificate in certificate chain" on Supabase/Aiven/Neon.
  if (!url.includes("sslmode=") && !url.includes("ssl=")) {
    const sep = url.includes("?") ? "&" : "?"
    return `${url}${sep}sslmode=no-verify`
  }

  return url
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: getConnectionString(),
    // Accept self-signed / chain certificates (Supabase pooler, Aiven, Neon)
    ssl: { rejectUnauthorized: false },
    // One connection per serverless function instance — prevents pool exhaustion
    max: 1,
  })

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
