import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"

// TODO: Add authentication middleware to protect this route
// TODO: Add async queue for long-running summarization tasks
// TODO: Add rate limiting

const PYTHON_API_URL = process.env.PYTHON_DOCS_API_URL || "http://localhost:8000"

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const url = formData.get("url")

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Proxy request to Python FastAPI backend
    const response = await fetch(`${PYTHON_API_URL}/summarize/url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ url: url.toString() }),
    })

    if (!response.ok) {
      throw new Error("Python API request failed")
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Document summarization error:", error)
    return NextResponse.json({ error: "Failed to summarize document" }, { status: 500 })
  }
}
