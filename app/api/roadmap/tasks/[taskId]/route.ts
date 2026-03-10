import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const { completed } = await req.json()

    const task = await prisma.roadmapTask.update({
      where: { id: taskId },
      data: { completed },
    })

    return NextResponse.json(task)
  } catch (error) {
    console.error("Task PATCH error:", error)
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }
}

