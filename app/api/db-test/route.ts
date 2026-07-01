import { NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"

export const runtime = "nodejs"

export async function GET() {
  const start = Date.now()
  try {
    const db = await getDb("resumeiq")
    // Ping the database
    await db.command({ ping: 1 })
    const elapsed = Date.now() - start

    return NextResponse.json({
      status: "connected",
      database: "resumeiq",
      latencyMs: elapsed,
      message: "MongoDB connection successful ✅",
    })
  } catch (error) {
    const err = error as Error & { originalError?: Error }
    const elapsed = Date.now() - start

    return NextResponse.json(
      {
        status: "failed",
        latencyMs: elapsed,
        message: err.message,
        cause: err.originalError?.message,
        suggestions: [
          "1. Go to MongoDB Atlas → Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)",
          "2. Verify your cluster is active (not paused) in Atlas",
          "3. Check that MONGODB_URI username/password are correct",
          "4. If on a college/corporate network, SRV lookups may be blocked — try mobile hotspot",
        ],
      },
      { status: 503 },
    )
  }
}
