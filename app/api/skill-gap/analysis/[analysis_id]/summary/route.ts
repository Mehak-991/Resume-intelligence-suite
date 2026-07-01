import { NextRequest, NextResponse } from "next/server"

const SKILL_GAP_API = process.env.SKILL_GAP_API_URL ?? "http://localhost:8002"

type Params = { params: Promise<{ analysis_id: string }> }

/**
 * GET /api/skill-gap/analysis/[analysis_id]/summary
 * Returns a concise summary of a completed analysis.
 */
export async function GET(_req: NextRequest, { params }: Params) {
    const { analysis_id } = await params
    try {
        console.log(`[Next.js API Route GET /api/skill-gap/analysis/${analysis_id}/summary] Fetching summary from: ${SKILL_GAP_API}/analysis/${analysis_id}/summary`)
        const res = await fetch(`${SKILL_GAP_API}/analysis/${analysis_id}/summary`)
        const data = await res.json().catch(() => ({ error: "Invalid response" }))
        console.log(`[Next.js API Route GET /api/skill-gap/analysis/${analysis_id}/summary] Backend response status: ${res.status}`)
        return NextResponse.json(data, { status: res.status })
    } catch (err: unknown) {
        console.error(`[Next.js API Route GET /api/skill-gap/analysis/${analysis_id}/summary] Connection failed:`, err)
        const message = err instanceof Error ? err.message : "Failed to reach skill gap service"
        return NextResponse.json({ 
            error: `Failed to reach skill gap service (Backend at ${SKILL_GAP_API} might be down)`, 
            details: message 
        }, { status: 502 })
    }
}
