/**
 * GET /api/users/me
 * -----------------
 * Returns the current Clerk user's DB profile + role.
 *
 * FIX: The super_admin upgrade now runs UNCONDITIONALLY whenever
 * isSuperAdmin is true — it no longer depends on other fields changing.
 * This was the root cause: if name/email/image hadn't changed, the
 * needsSync check was false and the role was never upgraded.
 */

import { NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

function getSuperAdminEmail(): string | null {
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

    // Always fetch live Clerk user — correct Clerk v7 API
    const clerkUser = await currentUser()
    if (!clerkUser) return NextResponse.json({ error: "Clerk user not found" }, { status: 404 })

    // Clerk v7: email at emailAddresses[0].emailAddress
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? ""
    const name = clerkUser.fullName ?? clerkUser.firstName ?? undefined
    const imageUrl = clerkUser.imageUrl ?? undefined

    const superAdminEmail = getSuperAdminEmail()
    const isSuperAdmin = !!superAdminEmail && email.toLowerCase() === superAdminEmail.toLowerCase()

    // Look up existing DB record
    let dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })

    if (!dbUser) {
      // First login — create the record with correct role immediately
      dbUser = await prisma.user.create({
        data: {
          clerkId: userId,
          email,
          name,
          imageUrl,
          role: isSuperAdmin ? "super_admin" : "user",
        },
      })
    } else {
      // Always upgrade to super_admin if email matches — NO conditional checks.
      // Previously this was gated behind needsSync which could be false
      // even when the role needed upgrading. Now it always runs independently.
      if (isSuperAdmin && dbUser.role !== "super_admin") {
        dbUser = await prisma.user.update({
          where: { clerkId: userId },
          data: { role: "super_admin", email, name, imageUrl },
        })
      } else {
        // Sync profile fields if anything changed
        const needsProfileSync =
          dbUser.email !== email ||
          dbUser.name !== (name ?? null) ||
          dbUser.imageUrl !== (imageUrl ?? null)

        if (needsProfileSync) {
          dbUser = await prisma.user.update({
            where: { clerkId: userId },
            data: { email, name, imageUrl },
          })
        }
      }
    }

    return NextResponse.json(dbUser)
  } catch (err) {
    console.error("Users/me error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
