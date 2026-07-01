import { type NextRequest, NextResponse } from "next/server"

const INTERVIEW_API_URL = process.env.INTERVIEW_API_URL || "http://localhost:8081"

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()

        const response = await fetch(`${INTERVIEW_API_URL}/api/interview/setup`, {
            method: "POST",
            body: formData,
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error("[interview/setup] Python API error:", errorText)
            return NextResponse.json(
                { error: "Failed to setup interview session", detail: errorText },
                { status: response.status }
            )
        }

        const data = await response.json()

        // Normalize response: ensure questions array is in the expected shape
        // Python returns: { session_id, message, questions_count, questions_preview }
        // We enrich with full question list from sessions if available
        return NextResponse.json(data)
    } catch (error) {
        console.error("[interview/setup] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
