/**
 * scripts/setup-database.ts
 * ─────────────────────────
 * Runs during Vercel build to push the Prisma schema to the database.
 * Compatible with any PostgreSQL provider (NeonDB, Nile, Supabase, Railway, etc.)
 *
 * Retries up to 3 times with delays to handle cold-starting serverless databases.
 * Exits with code 1 on permanent failure so Vercel surfaces the error.
 *
 * Environment flags:
 *   SKIP_DB_PUSH=true   — skip this step entirely (useful when using migrations)
 *   ACCEPT_DATA_LOSS=true — pass --accept-data-loss to prisma db push
 *                           (default: off — safer for production)
 */

import { execSync } from "child_process"

const DATABASE_URL =
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL?.trim() ||
  process.env.POSTGRES_PRISMA_URL?.trim()

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5_000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function pushSchema(attempt: number): Promise<boolean> {
  // Only pass --accept-data-loss when explicitly opted in
  const acceptDataLoss = process.env.ACCEPT_DATA_LOSS === "true"
  const dataLossFlag = acceptDataLoss ? " --accept-data-loss" : ""

  console.log(`[setup-database] prisma db push${dataLossFlag} — attempt ${attempt}/${MAX_RETRIES}`)
  try {
    execSync(`npx prisma db push${dataLossFlag}`, {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: DATABASE_URL,
      },
    })
    return true
  } catch {
    return false
  }
}

async function main() {
  // Allow CI / migration-based workflows to skip this step
  if (process.env.SKIP_DB_PUSH === "true") {
    console.log("[setup-database] SKIP_DB_PUSH=true — skipping schema push.")
    process.exit(0)
  }

  console.log("[setup-database] Starting database schema sync...")

  if (!DATABASE_URL) {
    console.error(
      "[setup-database] ❌ No database URL found.\n" +
        "  Set DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL) in your\n" +
        "  Vercel project environment variables and redeploy.\n" +
        "  To skip this step entirely, set SKIP_DB_PUSH=true."
    )
    process.exit(1)
  }

  const maskedUrl = DATABASE_URL.replace(/:([^@]+)@/, ":****@")
  console.log(`[setup-database] Using DB: ${maskedUrl}`)

  if (process.env.ACCEPT_DATA_LOSS !== "true") {
    console.warn(
      "[setup-database] ⚠️  Running without --accept-data-loss (safe default).\n" +
        "  If the push fails due to destructive changes, either:\n" +
        "    1. Set ACCEPT_DATA_LOSS=true in Vercel env vars, or\n" +
        "    2. Use prisma migrate deploy for production migrations."
    )
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const ok = await pushSchema(attempt)
    if (ok) {
      console.log("[setup-database] ✅ Schema push successful!")
      process.exit(0)
    }

    if (attempt < MAX_RETRIES) {
      console.log(
        `[setup-database] ⚠️  Attempt ${attempt} failed. ` +
          `Retrying in ${RETRY_DELAY_MS / 1000}s...`
      )
      await sleep(RETRY_DELAY_MS)
    }
  }

  console.error(
    `[setup-database] ❌ Schema push failed after ${MAX_RETRIES} attempts.\n` +
      "  Check your DATABASE_URL and that your database is accessible.\n" +
      "  You can also run scripts/init-database.sql directly in your DB's SQL editor.\n" +
      "  Set SKIP_DB_PUSH=true to bypass this step if you manage migrations manually."
  )
  process.exit(1)
}

main()

