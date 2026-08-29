import { type NextRequest, NextResponse } from "next/server"

import { getUserFromRequest } from "@/lib/auth"

// TODO: Add authentication middleware to protect this route
// TODO: Add async queue for long-running summarization tasks
// TODO: Add file size validation

const PYTHON_API_URL = process.env.PYTHON_DOCS_API_URL || "http://127.0.0.1:8000"

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
    const buffer = Buffer.from(await file.arrayBuffer())
    const pythonFormData = new FormData()
    const blob = new Blob([buffer], { type: file.type })
    pythonFormData.append("file", blob, file.name)

    const response = await fetch(`${PYTHON_API_URL}/summarize/pdf`, {
      method: "POST",
      body: pythonFormData,
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`PYTHON ERROR STATUS: ${response.status}`)
      console.error(`PYTHON ERROR BODY: ${errText}`)
      throw new Error(`Python API request failed: ${response.status} ${errText}`)
    }

    const data = await response.json()
    console.log("SUCCESSFULLY PARSED JSON FROM PYTHON")
    return NextResponse.json(data)
  } catch (error) {
    const fs = require('fs');
    fs.appendFileSync('next_api_log.txt', 'Error: ' + error + '\n');
    if (error instanceof Error) {
        fs.appendFileSync('next_api_log.txt', 'Message: ' + error.message + '\nStack: ' + error.stack + '\nCause: ' + error.cause + '\n');
    }
    console.error("PDF summarization error:", error)
    return NextResponse.json({ error: "Failed to summarize PDF" }, { status: 500 })
  }
}
