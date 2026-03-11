import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(users)
  } catch (error) {
    console.error("Users GET error:", error)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { clerkId, email, name, imageUrl } = body

    if (!clerkId || !email) {
      return NextResponse.json({ error: "clerkId and email are required" }, { status: 400 })
    }

    // Support both spellings of the env variable
    const superAdminEmail = process.env.SUPPER_ADMIN_EMAIL ?? process.env.SUPER_ADMIN_EMAIL
    const role = superAdminEmail && email === superAdminEmail ? "super_admin" : "user"

    const user = await prisma.user.upsert({
      where: { clerkId },
      update: { email, name, imageUrl },
      create: { clerkId, email, name, imageUrl, role: role as "super_admin" | "user" },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("Users POST error:", error)
    return NextResponse.json({ error: "Failed to create/update user" }, { status: 500 })
  }
}
