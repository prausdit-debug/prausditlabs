/**
 * lib/api-auth.ts
 * ---------------
 * Shared helper for API-level write-protection.
 *
 * ACCESS RULES:
 *   super_admin  → full access (also identified by SUPER_ADMIN_EMAIL env var)
 *   admin        → full access
 *   developer    → full access to CRM data
 *   user         → READ only (GET requests pass through; writes blocked)
 *   unauthenticated agent → GETs pass through; writes blocked
 *
 * IMPORTANT: GET requests are intentionally NOT protected here.
 * AI agents (Gemini, etc.) must be able to read all data freely.
 * Only POST / PATCH / PUT / DELETE are gated.
 */

import { auth, currentUser } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const WRITER_ROLES = new Set(["super_admin", "admin", "developer"])

/** Reads the super-admin email from env, supporting both spellings, trimming whitespace */
function getSuperAdminEmail(): string | null {
  return (
    process.env.SUPER_ADMIN_EMAIL?.trim() ||
    process.env.SUPPER_ADMIN_EMAIL?.trim() ||
    null
  )
}

export type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; response: NextResponse }

/**
 * Call at the top of any write handler (POST / PATCH / DELETE).
 * Returns { ok: true, userId, role } on success, or { ok: false, response } to return immediately.
 *
 * Agents calling with no session → 401 on writes (they should use GET to read).
 */
export async function requireWriteAuth(): Promise<AuthResult> {
  try {
    const { userId } = await auth()

    if (!userId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Unauthorized: authentication required for write operations" },
          { status: 401 }
        ),
      }
    }

    // Look up DB user to get role
    const user = await prisma.user.findUnique({ where: { clerkId: userId } })

    if (!user) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Unauthorized: user record not found" },
          { status: 401 }
        ),
      }
    }

    // Get live email from Clerk — correct Clerk v7 API: currentUser().emailAddresses[0].emailAddress
    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses[0]?.emailAddress ?? user.email

    const superAdminEmail = getSuperAdminEmail()
    const isSuperAdmin = !!superAdminEmail && email === superAdminEmail

    const effectiveRole = isSuperAdmin ? "super_admin" : user.role

    if (!WRITER_ROLES.has(effectiveRole)) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: `Forbidden: your role (${effectiveRole}) does not have write access. Required: admin, developer, or super_admin.`,
          },
          { status: 403 }
        ),
      }
    }

    return { ok: true, userId, role: effectiveRole }
  } catch (err) {
    console.error("requireWriteAuth error:", err)
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Internal server error during auth check" },
        { status: 500 }
      ),
    }
  }
}
