import { NextRequest, NextResponse } from "next/server"

const SKILL_GAP_API = process.env.SKILL_GAP_API_URL ?? "http://localhost:8002"

type Params = { params: Promise<{ analysis_id: string }> }

/**
 * GET /api/skill-gap/analysis/[analysis_id]/status
 * Polls the status of a running analysis.
 */
export async function GET(_req: NextRequest, { params }: Params) {
    const { analysis_id } = await params
    try {
        const res = await fetch(`${SKILL_GAP_API}/analysis/${analysis_id}/status`)
        const data = await res.json().catch(() => ({ error: "Invalid response" }))
        return NextResponse.json(data, { status: res.status })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to reach skill gap service"
        return NextResponse.json({ error: message }, { status: 502 })
    }
}
