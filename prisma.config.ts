/**
 * prisma.config.ts
 * ----------------
 * Prisma ORM v7: DB connection URL lives here (NOT in schema.prisma).
 *
 * For migrations (prisma migrate deploy / db push), Prisma CLI uses
 * datasource.url from this file. For runtime queries, lib/prisma.ts
 * passes the connection string directly to PrismaPg adapter.
 *
 * Connection priority for migrations:
 *   DATABASE_URL — use the direct (non-pooled) URL here for reliable migrations.
 *   Supabase: use the "Direct connection" URL, not the pooler URL.
 */
import "dotenv/config"
import { defineConfig, env } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Use DATABASE_URL (direct connection) for CLI migrations.
    // Falls back to POSTGRES_PRISMA_URL if DATABASE_URL is not set.
    url: env("DATABASE_URL"),
  },
})
