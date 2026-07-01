import { type NextRequest, NextResponse } from "next/server"

// TODO: Add JWT authentication to verify user identity
// TODO: Add rate limiting per user/session
// TODO: Store chat history in database for persistence
// TODO: Implement user-specific vector stores
// TODO: Add conversation analytics and insights

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { question, session_id } = body

    if (!question || !session_id) {
      return NextResponse.json({ error: "Missing question or session_id" }, { status: 400 })
    }

    // Proxy to Python chatbot API at /py_files/chatbot.py
    // The Python API maintains in-memory conversation history per session
    const pythonApiUrl = process.env.PYTHON_CHATBOT_API_URL || "http://localhost:8083"

    const response = await fetch(`${pythonApiUrl}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Python API error:", errorText)
      return NextResponse.json({ error: "Failed to get answer" }, { status: response.status })
    }

    const data = await response.json()

    // TODO: Save conversation to database with user_id and session_id
    // TODO: Implement conversation search and retrieval
    // TODO: Add feedback mechanism (thumbs up/down)
    // TODO: Track token usage for billing/limits

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Query error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
