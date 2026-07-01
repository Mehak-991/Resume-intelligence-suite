import { type NextRequest, NextResponse } from "next/server"

const INTERVIEW_API_URL = process.env.INTERVIEW_API_URL || "http://localhost:8081"

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()

        const response = await fetch(`${INTERVIEW_API_URL}/api/interview/answer`, {
            method: "POST",
            body: formData,
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error("[interview/answer] Python API error:", errorText)
            return NextResponse.json(
                { error: "Failed to submit answer", detail: errorText },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("[interview/answer] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
