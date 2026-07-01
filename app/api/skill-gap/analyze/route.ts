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

        console.log(`[Next.js API Route POST /api/skill-gap/analyze] Proxying to: ${SKILL_GAP_API}/analyze`)
        const res = await fetch(`${SKILL_GAP_API}/analyze`, {
            method: "POST",
            body: formData,
        })

        const data = await res.json().catch(() => ({ error: "Invalid response from skill gap service" }))
        console.log(`[Next.js API Route POST /api/skill-gap/analyze] Backend response status: ${res.status}`)

        return NextResponse.json(data, { status: res.status })
    } catch (err: unknown) {
        console.error(`[Next.js API Route POST /api/skill-gap/analyze] Connection failed:`, err)
        const message = err instanceof Error ? err.message : "Failed to reach skill gap service"
        return NextResponse.json({ 
            error: `Failed to reach skill gap service (Backend at ${SKILL_GAP_API} might be down)`, 
            details: message 
        }, { status: 502 })
    }
}
