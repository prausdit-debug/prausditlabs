/**
 * GET /api/users/me
 *
 * KEY FIX: If the DB is unreachable (Aiven SSL / connection issues),
 * we still return a valid response for super_admin based purely on
 * the Clerk email match. This means the super_admin ALWAYS gets in
 * even when the database is having problems.
 *
 * For normal users: DB is required. If DB fails, they get 503.
 * For super_admin: DB failure is ignored — email match is enough.
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
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const clerkUser = await currentUser()
    if (!clerkUser) {
      return NextResponse.json({ error: "Clerk user not found" }, { status: 404 })
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? ""
    const name = clerkUser.fullName ?? clerkUser.firstName ?? undefined
    const imageUrl = clerkUser.imageUrl ?? undefined

    const superAdminEmail = getSuperAdminEmail()
    const isSuperAdmin =
      !!superAdminEmail && email.toLowerCase() === superAdminEmail.toLowerCase()

    try {
      let dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })

      if (!dbUser) {
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
        if (isSuperAdmin && dbUser.role !== "super_admin") {
          dbUser = await prisma.user.update({
            where: { clerkId: userId },
            data: { role: "super_admin", email, name, imageUrl },
          })
        } else {
          const needsSync =
            dbUser.email !== email ||
            dbUser.name !== (name ?? null) ||
            dbUser.imageUrl !== (imageUrl ?? null)

          if (needsSync) {
            dbUser = await prisma.user.update({
              where: { clerkId: userId },
              data: { email, name, imageUrl },
            })
          }
        }
      }

      return NextResponse.json(dbUser)

    } catch (dbErr) {
      console.error("Users/me DB error:", dbErr)

      if (isSuperAdmin) {
        console.warn("DB unavailable — granting super_admin access via email fallback")
        return NextResponse.json({
          id: "super_admin_fallback",
          clerkId: userId,
          email,
          name: name ?? null,
          imageUrl: imageUrl ?? null,
          role: "super_admin",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      return NextResponse.json(
        { error: "Database unavailable. Please try again shortly." },
        { status: 503 }
      )
    }

  } catch (err) {
    console.error("Users/me error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}