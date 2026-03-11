/**
 * lib/prisma.ts
 * -------------
 * Singleton Prisma client for Vercel serverless environments.
 *
 * Connection string priority:
 *   1. POSTGRES_PRISMA_URL  — Vercel Postgres / Supabase pooled URL
 *   2. POSTGRES_URL         — Vercel Postgres direct URL
 *   3. DATABASE_URL         — generic fallback (custom / Supabase / Aiven)
 *
 * SSL: rejectUnauthorized:false accepts self-signed certs (Supabase, Aiven).
 * max:1 prevents connection pool exhaustion on Vercel serverless.
 */

import { PrismaClient } from "@prisma/client"
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
  // This resolves "self-signed certificate in certificate chain" on Supabase/Aiven.
  if (!url.includes("sslmode=") && !url.includes("ssl=")) {
    const sep = url.includes("?") ? "&" : "?"
    return `${url}${sep}sslmode=no-verify`
  }

  return url
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
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