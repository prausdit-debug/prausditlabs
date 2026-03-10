import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const SYSTEM_PROMPT = `You are PyCode-SLM Lab Assistant, an expert AI research assistant helping with the development of a Python-specialized Small Language Model (SLM).

You have deep expertise in:
- Machine learning and deep learning
- Python code generation and evaluation  
- LoRA and QLoRA fine-tuning techniques
- Dataset engineering and curation
- Model quantization (GPTQ, GGUF, AWQ, INT8)
- HumanEval, MBPP benchmarks
- TinyLlama, Phi-2, CodeGemma architectures
- Training infrastructure (PyTorch, transformers, PEFT, trl)
- Deployment on low-resource devices

When answering questions:
1. Be precise and technical
2. Include Python code examples when relevant
3. Reference the project context (PyCode-SLM, 300M-500M params, 2-4GB RAM target)
4. Use the provided documentation context when available
5. Format code in markdown code blocks with language tags`

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "GOOGLE_GEMINI_API_KEY not configured" }, { status: 500 })
    }

    // Fetch relevant docs from DB as context
    let contextDocs = ""
    try {
      const docs = await prisma.documentationPage.findMany({
        where: {
          OR: [
            { content: { contains: message.split(" ").slice(0, 5).join(" "), mode: "insensitive" } },
            { title: { contains: message.split(" ")[0], mode: "insensitive" } },
          ]
        },
        take: 2,
        select: { title: true, content: true }
      })

      if (docs.length > 0) {
        contextDocs = `\n\n## Relevant Documentation Context\n\n` +
          docs.map(d => `### ${d.title}\n${d.content.substring(0, 1500)}`).join("\n\n")
      }
    } catch {
      // Silently ignore if DB not available
    }

    // Build conversation for Gemini
    const contents = []

    // Add history
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) { // Last 10 messages
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        })
      }
    }

    // Add current message with context
    const userMessage = contextDocs
      ? `${message}\n\n${contextDocs}`
      : message

    contents.push({ role: "user", parts: [{ text: userMessage }] })

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:streamGenerateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.7,
            topP: 0.9,
          }
        })
      }
    )

    if (!geminiResponse.ok) {
      const err = await geminiResponse.text()
      console.error("Gemini error:", err)
      return NextResponse.json({ error: "Failed to reach AI" }, { status: 500 })
    }

    // Stream the response
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        const reader = geminiResponse.body?.getReader()
        if (!reader) { controller.close(); return }

        let buffer = ""
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += new TextDecoder().decode(value)

            // Parse streaming JSON chunks
            const lines = buffer.split("\n")
            buffer = lines.pop() ?? ""

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || trimmed === "[" || trimmed === "]" || trimmed === ",") continue

              try {
                const cleanLine = trimmed.replace(/^,/, "")
                const parsed = JSON.parse(cleanLine)
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
                if (text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
                }
              } catch {
                // Skip unparseable chunks
              }
            }
          }
        } catch (err) {
          console.error("Stream error:", err)
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        }
      }
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      }
    })
  } catch (err) {
    console.error("Chat API error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
