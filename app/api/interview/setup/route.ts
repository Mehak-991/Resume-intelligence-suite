import { type NextRequest, NextResponse } from "next/server"

const INTERVIEW_API_URL = process.env.INTERVIEW_API_URL || "http://127.0.0.1:8082"

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()

        // Validate request parameters before forwarding
        const resume = formData.get("resume")
        const candidateName = formData.get("candidate_name")
        const position = formData.get("position")
        const jobDescription = formData.get("job_description")

        if (!resume) {
            console.error("[interview/setup] Error: Missing resume upload")
            return NextResponse.json({ success: false, error: "Resume upload is missing." }, { status: 400 })
        }
        if (!candidateName) {
            console.error("[interview/setup] Error: Missing candidate name")
            return NextResponse.json({ success: false, error: "Candidate name is missing." }, { status: 400 })
        }
        if (!position) {
            console.error("[interview/setup] Error: Missing position")
            return NextResponse.json({ success: false, error: "Position title is missing." }, { status: 400 })
        }
        if (!jobDescription) {
            console.error("[interview/setup] Error: Missing job description")
            return NextResponse.json({ success: false, error: "Job description is missing." }, { status: 400 })
        }

        console.log(`[interview/setup] Proxying setup request to backend at ${INTERVIEW_API_URL}`)
        const response = await fetch(`${INTERVIEW_API_URL}/api/interview/setup`, {
            method: "POST",
            body: formData,
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error("[interview/setup] Python API error:", errorText)
            return NextResponse.json(
                { success: false, error: `Backend service setup failed: ${errorText}` },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("[interview/setup] Exception stack trace:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        )
    }
}
