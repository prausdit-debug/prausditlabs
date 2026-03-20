/**
 * GET  /api/users — list all users (admin/super_admin ONLY)
 * POST /api/users — upsert current user on first Clerk login (session-derived identity)
 *
 * FIXES:
 *  - GET was returning full PII roster to ANY authenticated user (any role).
 *    Now requires admin or super_admin role.
 *  - POST was unauthenticated and trusted client-supplied clerkId + email,
 *    allowing DB poisoning via fake super-admin email injection.
 *    Now derives all identity fields from the verified Clerk session.
 */

import { NextResponse }    from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { prisma }          from "@/lib/prisma"
import { getSuperAdminEmail, getEffectiveUser } from "@/lib/api-auth"
import { toApiError }      from "@/lib/errors"

// ─── GET /api/users ───────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Step 1: verify session
    const actor = await getEffectiveUser()
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Step 2: require admin-level role — regular users cannot enumerate all accounts
    if (!["super_admin", "admin"].includes(actor.role)) {
      return NextResponse.json(
        { error: "Forbidden: only admins can view the user list" },
        { status: 403 }
      )
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id:        true,
        clerkId:   true,
        email:     true,
        name:      true,
        imageUrl:  true,
        role:      true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json(users)
  } catch (error) {
    console.error("[/api/users GET] Database error:", {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json([], { status: 200 })
  }
}

// ─── POST /api/users ──────────────────────────────────────────────────────────

export async function POST() {
  try {
    // Step 1: require a valid Clerk session — NEVER trust client-supplied identity
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Step 2: derive ALL identity fields server-side from Clerk
    const clerkUser = await currentUser()
    if (!clerkUser) {
      return NextResponse.json({ error: "Clerk user not found" }, { status: 404 })
    }

    // These values come from the verified Clerk session — never from the request body
    const email    = clerkUser.emailAddresses[0]?.emailAddress ?? ""
    const name     = clerkUser.fullName ?? clerkUser.firstName ?? undefined
    const imageUrl = clerkUser.imageUrl ?? undefined

    const superAdminEmail = getSuperAdminEmail()
    const isSuperAdmin    =
      !!superAdminEmail &&
      !!email &&
      email.toLowerCase() === superAdminEmail.toLowerCase()

    const user = await prisma.user.upsert({
      where:  { clerkId: userId },
      update: {
        email,
        name:     name     ?? undefined,
        imageUrl: imageUrl ?? undefined,
        ...(isSuperAdmin ? { role: "super_admin" } : {}),
      },
      create: {
        clerkId:  userId,
        email,
        name:     name     ?? undefined,
        imageUrl: imageUrl ?? undefined,
        role: isSuperAdmin ? "super_admin" : "user",
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("[/api/users POST] Error:", {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: toApiError(error, "api/users POST") },
      { status: 500 }
    )
  }
}
