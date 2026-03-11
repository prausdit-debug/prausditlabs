/**
 * GET  /api/users  — list all users (admin dashboard)
 * POST /api/users  — create or upsert a user on first login
 */

import { NextResponse } from "next/server"
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
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(users)
  } catch (error) {
    // Log the full error for Vercel log inspection
    console.error("[/api/users GET] Database error:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    // Return empty array so the dashboard doesn't crash — shows an empty table instead
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { clerkId, email, name, imageUrl } = body

    if (!clerkId || !email) {
      return NextResponse.json(
        { error: "clerkId and email are required" },
        { status: 400 }
      )
    }

    // Super-admin email check happens at creation time so the role is set correctly
    const superAdminEmail = getSuperAdminEmail()
    const isSuperAdmin =
      !!superAdminEmail &&
      email.toLowerCase() === superAdminEmail.toLowerCase()

    const role = isSuperAdmin ? "super_admin" : "user"

    const user = await prisma.user.upsert({
      where: { clerkId },
      update: {
        // Never downgrade an existing super_admin or admin via this endpoint
        email,
        name: name ?? undefined,
        imageUrl: imageUrl ?? undefined,
      },
      create: {
        clerkId,
        email,
        name: name ?? undefined,
        imageUrl: imageUrl ?? undefined,
        role: role as "super_admin" | "user",
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("[/api/users POST] Error:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: "Failed to create/update user" },
      { status: 500 }
    )
  }
}

