/**
 * prisma.config.ts
 * ─────────────────
 * Prisma ORM v7 — CLI configuration.
 * Used by: prisma generate, prisma db push, prisma migrate deploy/dev
 *
 * ─── URL Priority ────────────────────────────────────────────────────────────
 *
 *   DATABASE_URL        → checked first. Used by Nile, Railway, Render, most providers.
 *   POSTGRES_URL        → Vercel Postgres / Supabase direct URL
 *   POSTGRES_PRISMA_URL → Vercel Postgres / Supabase pooled URL
 *
 * For migrations and db push, always use a DIRECT (non-pooled) connection URL.
 * Pooled connections (PgBouncer/Supavisor in transaction mode) do not support DDL.
 *
 * ─── Provider-specific URL formats ───────────────────────────────────────────
 *
 *   NeonDB:
 *     DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
 *
 *   Nile (thenile.dev):
 *     DATABASE_URL=postgres://user:pass@region.db.thenile.dev:5432/mydb?sslmode=require
 *
 *   Supabase:
 *     DATABASE_URL=postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres?sslmode=require
 *
 *   Railway:
 *     DATABASE_URL=postgresql://postgres:pass@monorail.proxy.rlwy.net:PORT/railway?sslmode=require
 *
 *   Render:
 *     DATABASE_URL=postgresql://user:pass@host.oregon-postgres.render.com/dbname?sslmode=require
 *
 *   Aiven:
 *     DATABASE_URL=postgresql://user:pass@host.aivencloud.com:PORT/defaultdb?sslmode=require
 *
 *   Local / Docker (no SSL):
 *     DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb
 *
 * All standard PostgreSQL sslmode values are supported: disable, allow, prefer,
 * require, verify-ca, verify-full. See lib/prisma.ts for full SSL documentation.
 */
import { defineConfig } from "prisma/config"

const migrationUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL?.trim() ||
  process.env.POSTGRES_PRISMA_URL?.trim() ||
  // Placeholder lets `prisma generate` succeed in CI without a real DB URL.
  // The build script (scripts/setup-database.ts) will error if no real URL is set.
  "postgresql://placeholder:placeholder@localhost:5432/placeholder"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl,
  },
})
