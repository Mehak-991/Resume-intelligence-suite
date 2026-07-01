import { type NextRequest, NextResponse } from "next/server"

// TODO: Add authentication middleware to protect this endpoint
// TODO: Add rate limiting to prevent abuse
// TODO: Add file size validation (recommend max 10MB per file)
// TODO: Store uploaded files in blob storage for persistence
// TODO: Associate uploaded documents with user accounts

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("files")

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    // Proxy to Python chatbot API at /py_files/chatbot.py
    // The Python API expects multipart/form-data with "files" field
    const pythonApiUrl = process.env.PYTHON_CHATBOT_API_URL || "http://localhost:8083"

    const response = await fetch(`${pythonApiUrl}/upload`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Python API error:", errorText)
      return NextResponse.json({ error: "Failed to process files" }, { status: response.status })
    }

    const data = await response.json()

    // TODO: Store vector embeddings in persistent storage (e.g., Pinecone, Weaviate)
    // TODO: Associate session with user authentication
    // TODO: Add analytics tracking for file uploads

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
