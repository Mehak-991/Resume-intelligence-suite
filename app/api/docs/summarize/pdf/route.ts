import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"

// TODO: Add authentication middleware to protect this route
// TODO: Add async queue for long-running summarization tasks
// TODO: Add file size validation

const PYTHON_API_URL = process.env.PYTHON_DOCS_API_URL || "http://localhost:8000"

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 })
    }

    // Forward file to Python FastAPI backend
    const pythonFormData = new FormData()
    pythonFormData.append("file", file)

    const response = await fetch(`${PYTHON_API_URL}/summarize/pdf`, {
      method: "POST",
      body: pythonFormData,
    })

    if (!response.ok) {
      throw new Error("Python API request failed")
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("PDF summarization error:", error)
    return NextResponse.json({ error: "Failed to summarize PDF" }, { status: 500 })
  }
}
