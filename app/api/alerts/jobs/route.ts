import { type NextRequest, NextResponse } from "next/server"
import { createRequire } from "module"
import mongoose from "mongoose"
import JobPosting from "../../../../backend/models/JobPosting"

const require = createRequire(import.meta.url)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const keyword = searchParams.get("keyword")
    const location = searchParams.get("location")
    const company = searchParams.get("company")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    // Connect to MongoDB if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI!)
    }

    // Auto-sync from Google Sheet on every request
    // Errors are caught so existing DB data is still returned on failure
    try {
      console.log("[Jobs] Syncing from Google Sheet...")
      const { syncJobsFromSheet } = require("../../../../backend/scripts/syncJobs")
      await syncJobsFromSheet()
      console.log("[Jobs] Sync complete.")
    } catch (syncError) {
      console.error("[Jobs] Sync failed, returning existing DB data:", syncError)
    }

    const query: any = {}

    if (keyword) {
      const searchRegex = new RegExp(keyword.trim(), 'i')
      query.$or = [
        { job_title: { $regex: searchRegex } },
        { company_name: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { keywords: { $regex: searchRegex } }
      ]
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' }
    }

    if (company) {
      query.company_name = { $regex: company, $options: 'i' }
    }

    const jobs = await JobPosting.find(query)
      .limit(limit)
      .sort({ posted_date: -1 })
      .lean()

    return NextResponse.json({
      success: true,
      jobs,
      count: jobs.length,
    })
  } catch (error) {
    console.error("Job search error:", error)
    return NextResponse.json({ error: "Failed to search jobs" }, { status: 500 })
  }
}
