import { type NextRequest, NextResponse } from "next/server"
import { createRequire } from "module"
import mongoose from "mongoose"
import Hackathon from "../../../../backend/models/Hackathon"

const require = createRequire(import.meta.url)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")

    // Connect to MongoDB if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI!)
    }

    // Auto-sync from Google Sheet on every request
    // Errors are caught so existing DB data is still returned on failure
    try {
      console.log("[Hackathons] Syncing from Google Sheet...")
      const { syncHackathonsFromSheet } = require("../../../../backend/scripts/syncHackathons")
      await syncHackathonsFromSheet()
      console.log("[Hackathons] Sync complete.")
    } catch (syncError) {
      console.error("[Hackathons] Sync failed, returning existing DB data:", syncError)
    }

    const hackathons = await Hackathon.find({})
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({
      success: true,
      hackathons,
      count: hackathons.length,
    })
  } catch (error) {
    console.error("Hackathons fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch hackathons" }, { status: 500 })
  }
}
