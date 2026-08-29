import { type NextRequest, NextResponse } from "next/server"

const INTERVIEW_API_URL = process.env.INTERVIEW_API_URL || "http://127.0.0.1:8082"

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()

        // Validate required params
        const sessionId = formData.get("session_id")
        const questionNumber = formData.get("question_number")
        const audioAnswer = formData.get("audio_answer")

        if (!sessionId) {
            console.error("[interview/answer] Error: Missing session_id")
            return NextResponse.json({ success: false, error: "Session ID is required." }, { status: 400 })
        }
        if (!questionNumber) {
            console.error("[interview/answer] Error: Missing question_number")
            return NextResponse.json({ success: false, error: "Question number is required." }, { status: 400 })
        }
        if (!audioAnswer) {
            console.error("[interview/answer] Error: Missing audio_answer file")
            return NextResponse.json({ success: false, error: "Audio answer recording is missing." }, { status: 400 })
        }

        console.log(`[interview/answer] Proxying answer submission to backend for session ${sessionId}`)
        const response = await fetch(`${INTERVIEW_API_URL}/api/interview/answer`, {
            method: "POST",
            body: formData,
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error("[interview/answer] Python API error:", errorText)
            return NextResponse.json(
                { success: false, error: `Failed to submit answer: ${errorText}` },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("[interview/answer] Exception stack trace:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        )
    }
}
