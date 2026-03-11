# ResearchDash — Upgrade & Fix Log (v0.1.0 → v0.2.0)

## Issues Detected & Fixed

### 1. Critical Runtime Error — Invalid Tailwind Class `bottom-22`
**File:** `components/chatbot/chatbot-widget.tsx`  
**Problem:** `bottom-22` is not a default Tailwind CSS utility class. This caused the chat
panel to render in the wrong position (or not render at all), producing a client-side layout crash.  
**Fix:** Changed to `bottom-24` (valid step) and made the panel fully responsive with
`max-w-[400px]` and `calc(100vw-2rem)` width on small screens.

### 2. Deprecated `node` Prop in react-markdown — TypeScript / Runtime Error
**File:** `components/docs/doc-content.tsx`  
**Problem:** The `code` component renderer destructured `{ node, className, children, ...props }`.
In react-markdown v9+, the `node` prop typing was changed, causing a TypeScript error that could
crash the client bundle in strict mode.  
**Fix:** Removed the unused `node` parameter and used `any` cast to maintain compatibility
across react-markdown v9.x versions.

### 3. Deprecated Google GenAI SDK (`@google/genai ^0.7.0`)
**File:** `app/api/chat/route.ts`, `package.json`  
**Problem:** The chat route bypassed the SDK entirely and used a raw `fetch()` call to the
Gemini REST API with the deprecated model `gemini-2.0-flash-exp`.  
**Fix:**  
- Upgraded `@google/genai` from `^0.7.0` → `^1.44.0` (GA release)  
- Rewrote chat route to use the official `GoogleGenAI` class  
- Changed model to `gemini-2.5-flash` (current stable)  
- Proper async streaming via `ai.models.generateContentStream()`  

### 4. Environment Variable Inconsistency
**File:** `app/api/chat/route.ts`  
**Problem:** The chat route only read `GOOGLE_GEMINI_API_KEY` but the project docs and `.env.example`
referenced `GOOGLE_API_KEY`. This caused silent failures on deployments using the standard key name.  
**Fix:** Chat route now accepts **both** `GOOGLE_API_KEY` and `GOOGLE_GEMINI_API_KEY` (fallback),
so either works. The canonical name is now `GOOGLE_API_KEY`.

### 5. No Mobile-Responsive Sidebar
**File:** `components/layout/sidebar.tsx`  
**Problem:** The sidebar was a fixed `w-60` panel with no mobile breakpoints. On phones/tablets
it took up the full width and had no way to collapse, making the app unusable on small screens.  
**Fix:** Created a fully responsive sidebar:
- Desktop (≥768px): Fixed sidebar always visible  
- Mobile (<768px): Hidden by default; hamburger button in header opens a slide-in drawer overlay  
- Close button and link-tap to dismiss on mobile  

### 6. Broken Font CSS Variables in Tailwind Config
**File:** `tailwind.config.ts`  
**Problem:** Font families referenced `var(--font-geist-sans)`, `var(--font-geist-mono)`,
`var(--font-display)` — CSS variables that were never declared anywhere in the project
(no `next/font/google` setup, no `@font-face`). This caused all text to fall back to system fonts
but also meant the Tailwind `font-sans` / `font-mono` classes did nothing intentional.  
**Fix:** Replaced with the actual Google Fonts already loaded via `@import` in `globals.css`:
`DM Sans` (sans) and `Space Mono` (mono).

### 7. Prisma Schema `output` Path — Prisma 6 Incompatibility
**File:** `prisma/schema.prisma`  
**Problem:** The `output = "../node_modules/.prisma/client"` directive was the legacy default
path from Prisma 4/5. In Prisma 6 it's the automatic default and specifying it explicitly
generates warnings and can cause duplicate client issues on Vercel.  
**Fix:** Removed the `output` field entirely (Prisma 6 uses the correct default automatically).

### 8. Missing Global Error Boundary
**File:** `app/error.tsx` (new)  
**Problem:** Any unhandled server component error would show Next.js's raw error page in
production, which is a poor user experience.  
**Fix:** Created `app/error.tsx` — a friendly error UI with the error message, digest ID
(for support), and a "Try again" button that calls `reset()`.

### 9. Spinner-Only Loading States (Poor UX)
**Files:** All `page.tsx` client pages  
**Problem:** All client pages showed a simple spinning `Loader2` icon while fetching data.
This causes layout shift and looks unprofessional.  
**Fix:** Replaced all spinner loading states with contextual `<Skeleton>` loaders that match
the shape of the actual content (cards, rows, etc).  
Also added `app/loading.tsx` for the root route.

### 10. Missing Empty States
**Files:** `app/datasets/page.tsx`, `app/experiments/page.tsx`  
**Problem:** When the database is empty (fresh deploy), pages rendered empty containers with
no feedback to the user, which looks broken.  
**Fix:** Added empty state components with icons and instructional copy like
_"No datasets yet. Add your first dataset using the button above."_

### 11. Outdated ESLint (v8 → v9)
**File:** `package.json`  
**Problem:** ESLint 8 was used, which produces deprecation warnings about `humanwhocodes` packages,
`glob`, `inflight`, and `rimraf` during npm install.  
**Fix:** Upgraded to ESLint 9 (`^9`).

### 12. Outdated Dependencies (various)
All dependencies upgraded to latest stable versions as of March 2026:
- `next` → `^15.3.0`
- `react` / `react-dom` → `^19.1.0`  
- `@prisma/client` / `prisma` → `^6.6.0`
- `framer-motion` → `^12.6.5`
- `lucide-react` → `^0.503.0`
- `tailwind-merge` → `^2.6.0`
- `cmdk` → `^1.1.1`
- All `@radix-ui/*` → latest minor versions
- `@types/node` → `^22`, `@types/react` → `^19`

---

## Required Environment Variables

Set these in your `.env` file or Vercel dashboard:

```bash
DATABASE_URL="postgresql://..."   # Azure PostgreSQL / Neon / Supabase
GOOGLE_API_KEY="..."              # From https://aistudio.google.com/app/apikey
```

## Deployment Steps

```bash
npm install
npx prisma generate
npx prisma migrate deploy   # or db:push for first-time
npm run build
```
