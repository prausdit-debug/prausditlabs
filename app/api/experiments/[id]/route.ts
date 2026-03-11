import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWriteAuth } from "@/lib/api-auth"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWriteAuth()
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const body = await req.json()

    const exp = await prisma.experiment.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.evalLoss !== undefined && { evalLoss: Number(body.evalLoss) }),
        ...(body.evalAccuracy !== undefined && { evalAccuracy: Number(body.evalAccuracy) }),
        ...(body.pass1Score !== undefined && { pass1Score: Number(body.pass1Score) }),
        ...(body.bleuScore !== undefined && { bleuScore: Number(body.bleuScore) }),
      },
      include: {
        dataset: { select: { name: true } },
        logs: true,
      },
    })

    return NextResponse.json(exp)
  } catch (error) {
    console.error("Experiment PATCH error:", error)
    return NextResponse.json({ error: "Failed to update experiment" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWriteAuth()
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    await prisma.experiment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Experiment DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete experiment" }, { status: 500 })
  }
}

