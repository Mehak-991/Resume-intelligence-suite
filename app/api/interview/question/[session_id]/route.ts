import { type NextRequest, NextResponse } from "next/server"

const INTERVIEW_API_URL = process.env.INTERVIEW_API_URL || "http://localhost:8081"

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ session_id: string }> }
) {
    try {
        const { session_id } = await params

        const response = await fetch(
            `${INTERVIEW_API_URL}/api/interview/question/${session_id}`,
            { method: "GET" }
        )

        if (!response.ok) {
            const errorText = await response.text()
            console.error("[interview/question] Python API error:", errorText)
            return NextResponse.json(
                { error: "Failed to get question", detail: errorText },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("[interview/question] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
