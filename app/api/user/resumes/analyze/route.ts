import { NextResponse, type NextRequest } from "next/server"

import { v2 as cloudinary } from 'cloudinary'
import clientPromise from "@/lib/mongodb"
import { getUserFromRequest } from "@/lib/auth"

export const runtime = "nodejs"

const PYTHON_API_URL = process.env.PYTHON_RESUME_API_URL || "http://localhost:8080"

// Configure Cloudinary using CLOUDINARY_URL
if (process.env.CLOUDINARY_URL) {
  cloudinary.config(process.env.CLOUDINARY_URL)
} else {
  // Fallback to individual credentials if CLOUDINARY_URL is not set
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const resume = formData.get("resume") as File | null
    const jobDescription = formData.get("job_description")
    const recruiterEmail = formData.get("recruiter_email")

    if (!resume) {
      return NextResponse.json({ message: "Resume file is required" }, { status: 400 })
    }

    const isPdf = resume.type === "application/pdf" || resume.name.toLowerCase().endsWith(".pdf")
    if (!isPdf) {
      return NextResponse.json({ message: "Only PDF resumes are supported" }, { status: 400 })
    }

    const jdText = jobDescription ? String(jobDescription) : ""
    const recruiterEmailStr = recruiterEmail ? String(recruiterEmail) : ""

    // Upload resume to Cloudinary
    let resumeUrl: string | null = null
    try {
      const buffer = Buffer.from(await resume.arrayBuffer())
      const uploadResult = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: 'resumes',
            public_id: `${user.userId}_${Date.now()}_${resume.name.replace(/\.[^/.]+$/, "")}`,
            format: 'pdf'
          },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        ).end(buffer)
      })
      resumeUrl = uploadResult.secure_url
    } catch (error) {
      console.error('Cloudinary upload failed:', error)
      // Continue without Cloudinary upload - don't fail the entire process
    }

    const pythonFormData = new FormData()
    pythonFormData.append("resume", resume)
    pythonFormData.append("job_description", jdText)

    let pythonRes: Response
    try {
      pythonRes = await fetch(`${PYTHON_API_URL}/analyze_resume/`, {
        method: "POST",
        body: pythonFormData,
      })
    } catch (error) {
      const err = error as unknown as { message?: string }
      return NextResponse.json(
        {
          message: "Unable to reach resume optimizer service",
          ...(process.env.NODE_ENV !== "production" ? { debug: { message: err?.message } } : {}),
        },
        { status: 502 },
      )
    }

    if (!pythonRes.ok) {
      const raw = await pythonRes.text().catch(() => "")
      return NextResponse.json(
        {
          message: "Resume optimizer request failed",
          status: pythonRes.status,
          ...(process.env.NODE_ENV !== "production" ? { debug: { raw } } : {}),
        },
        { status: 502 },
      )
    }

    const pythonData = (await pythonRes.json()) as {
      parsed_json?: {
        overallATSScore?: number | null
        strengths?: string[]
        improvements?: string[]
        keywords?: string[]
        summary?: string | null
        performanceMetrics?: { parameter: string; score: number }[]
        actionItems?: string[]
        proTips?: string[]
        atsChecklist?: string[]
        optimizedResume?: string | null
      }
      raw_llm_output?: string
    }

    const parsed = pythonData.parsed_json || {}
    const overallATSScore = typeof parsed.overallATSScore === "number" ? parsed.overallATSScore : null
    const atsScore = overallATSScore === null ? null : Math.round(overallATSScore * 10)

    let client
    try {
      client = await clientPromise
    } catch (error) {
      const err = error as unknown as { name?: string; message?: string; code?: string; cause?: { code?: string } }
      return NextResponse.json(
        {
          message: "Database connection failed",
          ...(process.env.NODE_ENV !== "production"
            ? {
                debug: {
                  name: err?.name,
                  code: err?.code || err?.cause?.code,
                  message: err?.message,
                },
              }
            : {}),
        },
        { status: 503 },
      )
    }

    const db = client.db("resumeiq")
    const resumes = db.collection("resumes")

    const insertRes = await resumes.insertOne({
      userId: user.userId,
      fileName: resume.name,
      createdAt: new Date(),
      jdText,
      recruiterEmail: recruiterEmailStr,
      resumeUrl,
      atsScore,
      parsed,
      rawLlmOutput: pythonData.raw_llm_output || null,
      optimizedResume: parsed.optimizedResume || null,
    })

    return NextResponse.json({ id: insertRes.insertedId.toString() })
  } catch (error) {
    const err = error as unknown as { message?: string; stack?: string }
    return NextResponse.json(
      {
        message: "Internal server error",
        ...(process.env.NODE_ENV !== "production" ? { debug: { message: err?.message, stack: err?.stack } } : {}),
      },
      { status: 500 },
    )
  }
}
