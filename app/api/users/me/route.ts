/**
 * GET /api/users/me
 * -----------------
 * Returns the current Clerk user's database profile including their role.
 * Also handles auto-upsert: if the user doesn't exist in the DB yet (first login),
 * creates them. Grants super_admin if their email matches SUPPER_ADMIN_EMAIL.
 */

import { NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Try to find user in DB
    let user = await prisma.user.findUnique({ where: { clerkId: userId } })

    // Auto-upsert on first login (in case webhook missed it)
    if (!user) {
      const clerkUser = await currentUser()
      if (!clerkUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

      const email = clerkUser.emailAddresses[0]?.emailAddress ?? ""
      const superAdminEmail = process.env.SUPPER_ADMIN_EMAIL ?? process.env.SUPER_ADMIN_EMAIL
      const role = superAdminEmail && email === superAdminEmail ? "super_admin" : "user"

      user = await prisma.user.upsert({
        where: { clerkId: userId },
        update: { email, name: clerkUser.fullName ?? undefined, imageUrl: clerkUser.imageUrl ?? undefined },
        create: {
          clerkId: userId,
          email,
          name: clerkUser.fullName ?? undefined,
          imageUrl: clerkUser.imageUrl ?? undefined,
          role: role as "super_admin" | "user",
        },
      })
    } else {
      // Ensure existing user has super_admin if their email matches
      const superAdminEmail = process.env.SUPPER_ADMIN_EMAIL ?? process.env.SUPER_ADMIN_EMAIL
      if (superAdminEmail && user.email === superAdminEmail && user.role !== "super_admin") {
        user = await prisma.user.update({
          where: { clerkId: userId },
          data: { role: "super_admin" },
        })
      }
    }

    return NextResponse.json(user)
  } catch (err) {
    console.error("Users/me error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
