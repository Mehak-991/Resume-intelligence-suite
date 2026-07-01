import { NextRequest, NextResponse } from "next/server"

const SKILL_GAP_API = process.env.SKILL_GAP_API_URL ?? "http://localhost:8002"

/**
 * POST /api/skill-gap/analyze
 * Proxies multipart form-data (resume_pdf + job_description) to the
 * independent Skill Gap Analyzer FastAPI service.
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()

        const res = await fetch(`${SKILL_GAP_API}/analyze`, {
            method: "POST",
            body: formData,
        })

        const data = await res.json().catch(() => ({ error: "Invalid response from skill gap service" }))

        return NextResponse.json(data, { status: res.status })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to reach skill gap service"
        return NextResponse.json({ error: message }, { status: 502 })
    }
}
