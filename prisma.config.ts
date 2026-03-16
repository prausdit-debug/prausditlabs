import { defineConfig } from "prisma/config"

// Priority: DATABASE_URL -> POSTGRES_URL -> POSTGRES_PRISMA_URL -> placeholder
// The placeholder allows `prisma generate` to succeed without a real DB URL.
// The setup-database.ts script will error if no real URL is set at deploy time.
//
// For LOCAL dev: add DATABASE_URL to your .env file. Vercel injects it automatically.
//
// Supported providers and example URLs:
//   NeonDB:   postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
//   Nile:     postgres://user:pass@region.db.thenile.dev:5432/mydb?sslmode=require
//   Supabase: postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres?sslmode=require
//   Railway:  postgresql://postgres:pass@host.rlwy.net:PORT/railway?sslmode=require
//   Render:   postgresql://user:pass@host.render.com/dbname?sslmode=require
//   Aiven:    postgresql://user:pass@host.aivencloud.com:PORT/defaultdb?sslmode=require
//   Local:    postgresql://postgres:postgres@localhost:5432/mydb

const migrationUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL?.trim() ||
  process.env.POSTGRES_PRISMA_URL?.trim() ||
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
