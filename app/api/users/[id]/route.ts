import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWriteAuth } from "@/lib/api-auth"

/**
 * PATCH /api/users/[id]
 * Update a user's role or name.
 * Restricted to super_admin and admin only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const writeAuth = await requireWriteAuth()
  if (!writeAuth.ok) return writeAuth.response

  if (!["super_admin", "admin"].includes(writeAuth.role)) {
    return NextResponse.json(
      { error: "Forbidden: only admins can modify user roles" },
      { status: 403 }
    )
  }

  try {
    const { id } = await params
    const body = await req.json()

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.role && { role: body.role }),
        ...(body.name && { name: body.name }),
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("[/api/users/[id] PATCH] Error:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

/**
 * DELETE /api/users/[id]
 * Remove a user record.
 * Restricted to super_admin and admin only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const writeAuth = await requireWriteAuth()
  if (!writeAuth.ok) return writeAuth.response

  if (!["super_admin", "admin"].includes(writeAuth.role)) {
    return NextResponse.json(
      { error: "Forbidden: only admins can delete users" },
      { status: 403 }
    )
  }

  try {
    const { id } = await params
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[/api/users/[id] DELETE] Error:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}
