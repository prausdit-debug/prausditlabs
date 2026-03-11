# Bug Fixes — researchdash1

## Summary of all changes made

---

### 1. `lib/prisma.ts` — Prisma singleton + SSL fix

**Problem:** `POSTGRES_PRISMA_URL` was used directly with `!` (hard crash if unset). No SSL fallback logic. Self-signed certificate errors on Supabase/Aiven.

**Fix:**
- Connection string priority chain: `POSTGRES_PRISMA_URL` → `POSTGRES_URL` → `DATABASE_URL`
- Auto-injects `?sslmode=no-verify` if no SSL param is already present
- Sets `ssl: { rejectUnauthorized: false }` in the `pg` adapter
- Proper singleton pattern with `globalThis` guard (prevents connection exhaustion on Vercel serverless)

---

### 2. `lib/api-auth.ts` — Super admin check order

**Problem:** `requireWriteAuth()` called `prisma.user.findUnique()` BEFORE checking `SUPER_ADMIN_EMAIL`. When the DB was unreachable (TLS error), the entire function threw and returned "Internal server error during auth check" — blocking both the super admin AND AI agents.

**Fix:**
- Super admin email check runs **FIRST**, before any DB call
- If email matches `SUPER_ADMIN_EMAIL`, immediately returns `{ ok: true, role: "super_admin" }`
- DB errors are caught per-block and return `503` instead of `500`
- Auto-creates a `"user"` role DB record for first-time Clerk logins

---

### 3. `prisma/schema.prisma` — Missing datasource URL

**Problem:** The `datasource db` block had no `url` field. Prisma couldn't determine which database to connect to for migrations (`prisma migrate deploy`).

**Fix:**
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]  // required for @prisma/adapter-pg
}

datasource db {
  provider  = "postgresql"
  url       = env("POSTGRES_PRISMA_URL")
  directUrl = env("DATABASE_URL")  // used by prisma migrate (bypasses pooler)
}
```

---

### 4. `app/api/users/route.ts` — Error handling + logging

**Problem:** Errors were swallowed silently. No structured logging for Vercel log inspection.

**Fix:**
- Structured error logging with `message` and `stack`
- Super admin role correctly assigned on first user creation (case-insensitive email match)
- `upsert` no longer overwrites role on update (prevents admin downgrade)

---

### 5. `app/api/users/[id]/route.ts` — Error logging

**Problem:** Generic `console.error` with no structure.

**Fix:** Structured logging consistent with other routes.

---

### 6. `next.config.js` — Vercel serverless bundling

**Problem:** Only `pg-native` was excluded from the bundle. The `pg` package and `@prisma/adapter-pg` need to be treated as external packages too.

**Fix:**
```js
serverExternalPackages: ["pg-native", "@prisma/adapter-pg", "pg"]
```

---

### 7. `.env.example` — Complete variable documentation

Added all required environment variables with explanations:
- `POSTGRES_PRISMA_URL` (primary)
- `DATABASE_URL` (fallback + migrations)
- `CLERK_*` keys
- `SUPER_ADMIN_EMAIL`
- `GOOGLE_GEMINI_API_KEY`

---

## Environment Variables Required on Vercel

| Variable | Required | Purpose |
|---|---|---|
| `POSTGRES_PRISMA_URL` | ✅ (or DATABASE_URL) | Prisma runtime DB connection |
| `DATABASE_URL` | ✅ (or POSTGRES_PRISMA_URL) | Prisma migrations + fallback |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk auth (client) |
| `CLERK_SECRET_KEY` | ✅ | Clerk auth (server) |
| `SUPER_ADMIN_EMAIL` | ✅ | Super admin bypass |
| `GOOGLE_GEMINI_API_KEY` | ✅ | AI features |

## Auth Logic (corrected)

```
Request arrives at protected API route
  │
  ▼
1. Is user authenticated with Clerk?
   NO  → 401 Unauthorized
   YES → continue
  │
  ▼
2. Does email === SUPER_ADMIN_EMAIL? (checked BEFORE DB)
   YES → ✅ Allow (role: super_admin), skip DB entirely
   NO  → continue
  │
  ▼
3. Look up user in database
   DB ERROR → 503 Service Unavailable
   NOT FOUND → create user with role "user" → 403 Forbidden
   FOUND → continue
  │
  ▼
4. Is role in [super_admin, admin, developer]?
   YES → ✅ Allow
   NO  → 403 Forbidden
```

## Route Protection Map

| Path pattern | Protected? | Method |
|---|---|---|
| `/api/*` | ❌ GET free | Middleware passes all /api/* |
| `/api/*` | ✅ POST/PATCH/DELETE require auth | `requireWriteAuth()` in handlers |
| `/dashboard`, `/crm`, `/admin`, etc. | ✅ Clerk session + role | `AuthGuard` component |
| `/sign-in`, `/sign-up`, `/access-denied` | ❌ Public | Middleware allowlist |
