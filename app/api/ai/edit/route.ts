import { NextResponse } from "next/server"
import { generateText } from "ai"
import { gateway } from "@ai-sdk/gateway"

export async function POST(req: Request) {
  try {
    const { text, instruction } = await req.json()

    if (!text || !instruction) {
      return NextResponse.json(
        { error: "text and instruction are required" },
        { status: 400 }
      )
    }

    const { text: result } = await generateText({
      model: gateway("google/gemini-2.5-flash-preview-05-20"),
      system: `You are a helpful writing assistant. Your task is to edit text according to the user's instructions.
Return ONLY the edited text without any explanations, comments, or formatting markers.
Do not wrap the output in quotes or add any prefix/suffix.
Maintain the original formatting style (paragraphs, line breaks) unless asked to change it.`,
      prompt: `Original text:
"""
${text}
"""

Instructions: ${instruction}

Please provide the edited version:`,
    })

    return NextResponse.json({ result: result.trim() })
  } catch (error) {
    console.error("AI edit error:", error)
    return NextResponse.json(
      { error: "Failed to process AI edit" },
      { status: 500 }
    )
  }
}
