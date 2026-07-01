import { type NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import JobPosting from "../../../../backend/models/JobPosting"

// TODO: Add authentication middleware
// TODO: Add rate limiting to prevent abuse
// TODO: Add search analytics tracking

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { keyword, filters } = body

    if (!keyword || keyword.trim() === "") {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 })
    }

    // Connect to MongoDB if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI!)
    }

    // Create search query using regex for case-insensitive search
    const searchRegex = new RegExp(keyword.trim(), 'i')
    const query: any = {
      $or: [
        { job_title: { $regex: searchRegex } },
        { company_name: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { keywords: { $regex: searchRegex } } // Search in keywords for exact job title matches
      ]
    }

    // Apply additional filters if provided
    if (filters?.location) {
      query.location = { $regex: filters.location, $options: 'i' }
    }

    const jobs = await JobPosting.find(query)
      .sort({ posted_date: -1 })
      .limit(50)
      .lean()

    return NextResponse.json({
      success: true,
      results: jobs,
      count: jobs.length,
      keyword,
    })
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json({ error: "Failed to search" }, { status: 500 })
  }
}
