import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const pages = await prisma.documentationPage.findMany({
    orderBy: [{ section: "asc" }, { order: "asc" }],
  })
  return NextResponse.json(pages)
}

export async function POST(req: Request) {
  const body = await req.json()

  // Check uniqueness of slug
  const existing = await prisma.documentationPage.findUnique({
    where: { slug: body.slug }
  })
  if (existing) {
    return NextResponse.json({ error: "Slug already exists" }, { status: 400 })
  }

  const page = await prisma.documentationPage.create({
    data: {
      title: body.title,
      slug: body.slug,
      content: body.content,
      section: body.section || "Uncategorized",
      order: body.order || 99,
      tags: body.tags || [],
    }
  })
  return NextResponse.json(page)
}
