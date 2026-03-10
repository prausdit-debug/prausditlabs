import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") ?? ""

  if (!q.trim()) return NextResponse.json({ results: [] })

  const term = q.toLowerCase()

  const [docs, datasets, experiments, steps] = await Promise.all([
    prisma.documentationPage.findMany({
      where: { OR: [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
        { tags: { has: q } },
      ]},
      select: { id: true, title: true, slug: true, content: true, section: true },
      take: 5,
    }),
    prisma.dataset.findMany({
      where: { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ]},
      select: { id: true, name: true, datasetType: true },
      take: 3,
    }),
    prisma.experiment.findMany({
      where: { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { baseModel: { contains: q, mode: "insensitive" } },
      ]},
      select: { id: true, name: true, baseModel: true },
      take: 3,
    }),
    prisma.roadmapStep.findMany({
      where: { OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ]},
      select: { id: true, title: true, description: true, phase: true },
      take: 3,
    }),
  ])

  const results = [
    ...docs.map(d => ({
      id: d.id,
      title: d.title,
      type: "doc" as const,
      href: `/docs/${d.slug}`,
      excerpt: d.section,
    })),
    ...datasets.map(d => ({
      id: d.id,
      title: d.name,
      type: "dataset" as const,
      href: "/datasets",
      excerpt: d.datasetType,
    })),
    ...experiments.map(e => ({
      id: e.id,
      title: e.name,
      type: "experiment" as const,
      href: "/experiments",
      excerpt: e.baseModel,
    })),
    ...steps.map(s => ({
      id: s.id,
      title: s.title,
      type: "roadmap" as const,
      href: "/roadmap",
      excerpt: `Phase ${s.phase}`,
    })),
  ]

  return NextResponse.json({ results })
}
