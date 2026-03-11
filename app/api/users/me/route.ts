/**
 * GET /api/users/me
 * -----------------
 * Returns the current Clerk user's DB profile + role.
 *
 * Super-admin logic:
 *   - Reads SUPER_ADMIN_EMAIL (canonical spelling) with SUPPER_ADMIN_EMAIL as alias
 *   - Gets the authenticated user's email via Clerk's currentUser() (the correct v7 API)
 *   - If email matches → ALWAYS upserts role to super_admin in the DB, regardless of
 *     what was previously stored. This fixes the case where the user already exists
 *     in the DB as "user" before the env var was set.
 *
 * Clerk v7 email access: currentUser().emailAddresses[0].emailAddress
 */

import { NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

/** Reads the super-admin email from env, supporting both spellings */
function getSuperAdminEmail(): string | null {
  // Prefer the correctly-spelled var; fall back to the legacy typo
  return (
    process.env.SUPER_ADMIN_EMAIL?.trim() ||
    process.env.SUPPER_ADMIN_EMAIL?.trim() ||
    null
  )
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Always fetch the Clerk user so we have the live email — correct Clerk v7 API
    const clerkUser = await currentUser()
    if (!clerkUser) return NextResponse.json({ error: "Clerk user not found" }, { status: 404 })

    // Clerk v7: email lives at emailAddresses[0].emailAddress
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? ""
    const name = clerkUser.fullName ?? clerkUser.firstName ?? undefined
    const imageUrl = clerkUser.imageUrl ?? undefined

    const superAdminEmail = getSuperAdminEmail()
    const isSuperAdmin = !!superAdminEmail && email === superAdminEmail

    // Determine the role to write/ensure in the DB
    let targetRole: string | undefined = isSuperAdmin ? "super_admin" : undefined

    // Try to find existing DB record
    let dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })

    if (!dbUser) {
      // First login — create the record
      dbUser = await prisma.user.create({
        data: {
          clerkId: userId,
          email,
          name,
          imageUrl,
          role: (targetRole ?? "user") as "super_admin" | "admin" | "developer" | "user",
        },
      })
    } else {
      // User exists — always sync email/name/image, and force-upgrade to super_admin if needed
      const needsRoleUpgrade = isSuperAdmin && dbUser.role !== "super_admin"
      const needsSync =
        dbUser.email !== email ||
        dbUser.name !== name ||
        dbUser.imageUrl !== imageUrl ||
        needsRoleUpgrade

      if (needsSync) {
        dbUser = await prisma.user.update({
          where: { clerkId: userId },
          data: {
            email,
            name,
            imageUrl,
            ...(needsRoleUpgrade ? { role: "super_admin" } : {}),
          },
        })
      }
    }

    return NextResponse.json(dbUser)
  } catch (err) {
    console.error("Users/me error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
