/**
 * lib/api-auth.ts
 * ---------------
 * Shared helper for API-level write-protection.
 *
 * ACCESS RULES (evaluated in order):
 *   1. SUPER_ADMIN_EMAIL match → always allow, skip DB entirely
 *   2. DB role === "admin" | "developer" | "super_admin" → allow
 *   3. DB role === "user" → block writes (GET still passes via middleware)
 *   4. No DB record → block writes
 *   5. DB unreachable → block writes (but super_admin still allowed via rule 1)
 *
 * GET requests are intentionally NOT protected here.
 * AI agents (Gemini, etc.) must be able to read all data freely.
 * Only POST / PATCH / PUT / DELETE are gated.
 */

import { auth, currentUser } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const WRITER_ROLES = new Set(["super_admin", "admin", "developer"])

/** Reads the super-admin email from env, supporting both spellings */
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
 * CRITICAL FIX: Super-admin check runs BEFORE any DB query.
 * This means the super admin always gets through even when the DB is unreachable.
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

    // ── Step 1: Check super-admin by email BEFORE touching the database ──
    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses[0]?.emailAddress ?? ""

    const superAdminEmail = getSuperAdminEmail()
    const isSuperAdmin =
      !!superAdminEmail &&
      !!email &&
      email.toLowerCase() === superAdminEmail.toLowerCase()

    if (isSuperAdmin) {
      // Super admin bypasses all DB checks — always allowed
      return { ok: true, userId, role: "super_admin" }
    }

    // ── Step 2: For everyone else, look up role in the database ──
    let dbUser
    try {
      dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })
    } catch (dbErr) {
      console.error("requireWriteAuth DB error:", dbErr)
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Database unavailable. Please try again shortly." },
          { status: 503 }
        ),
      }
    }

    if (!dbUser) {
      // User authenticated with Clerk but no DB record yet.
      // Auto-create with default "user" role and deny write access.
      try {
        if (email) {
          await prisma.user.create({
            data: {
              clerkId: userId,
              email,
              name: clerkUser?.fullName ?? clerkUser?.firstName ?? undefined,
              imageUrl: clerkUser?.imageUrl ?? undefined,
              role: "user",
            },
          })
        }
      } catch (createErr) {
        console.error("requireWriteAuth user create error:", createErr)
      }

      return {
        ok: false,
        response: NextResponse.json(
          {
            error:
              "Forbidden: your account does not have write access. Contact an admin to upgrade your role.",
          },
          { status: 403 }
        ),
      }
    }

    const effectiveRole = dbUser.role

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
