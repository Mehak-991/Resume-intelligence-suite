import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth"

export const runtime = "nodejs"

const N8N_COLD_MAIL_URL = process.env.N8N_COLD_MAIL_URL

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    if (!N8N_COLD_MAIL_URL) {
      return NextResponse.json({ 
        message: "Cold mail service not configured" 
      }, { status: 503 })
    }

    const body = await req.json()
    const { resume_url, recruiter_email, job_description } = body

    // Get candidate email from authenticated user
    const candidate_email = user.email

    console.log("Candidate email extraction:", {
      userExists: !!user,
      userId: user?.userId,
      userEmail: user?.email,
      extractedCandidateEmail: candidate_email,
      userEmailType: typeof user?.email
    })

    console.log("Cold mail request received:", {
      resume_url: resume_url ? "PRESENT" : "MISSING",
      candidate_email: candidate_email ? "PRESENT" : "MISSING",
      recruiter_email: recruiter_email ? "PRESENT" : "MISSING",
      job_description: job_description ? "PRESENT" : "MISSING",
      fullBody: body,
      authenticatedUser: {
        userId: user.userId,
        email: user.email
      }
    })

    // Validate required fields
    if (!resume_url || !candidate_email || !recruiter_email) {
      console.log("Validation failed - missing required fields:", {
        has_resume_url: !!resume_url,
        has_candidate_email: !!candidate_email,
        has_recruiter_email: !!recruiter_email
      })
      return NextResponse.json({ 
        message: "Missing required fields: resume_url, candidate_email, recruiter_email" 
      }, { status: 400 })
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(candidate_email) || !emailRegex.test(recruiter_email)) {
      return NextResponse.json({ 
        message: "Invalid email format" 
      }, { status: 400 })
    }

    // Prepare payload for N8N with exact parameter names and sequence.
    // The n8n workflow expects these four fields, in this order:
    // 1) resume_url
    // 2) candidate_email
    // 3) recruiter's_email
    // 4) job_description
    //
    // To mirror the successful Postman call as closely as possible,
    // we send the data as multipart/form-data with fields appended
    // in the exact required sequence.
    const formData = new FormData()
    formData.append("resume_url", resume_url)
    formData.append("candidate_email", candidate_email)
    formData.append("recruiter's_email", recruiter_email)
    formData.append("job_description", job_description || "")

    // For debugging, also build a plain object representation.
    const n8nPayload = {
      resume_url,
      candidate_email,
      ["recruiter's_email"]: recruiter_email,
      job_description: job_description || "",
    }

    // Log the exact payload being sent to N8N (helpful for debugging).
    // In production, consider removing or redacting email fields.
    console.log("N8N raw payload (object):", n8nPayload)
    console.log("N8N raw payload (form-data order):", [
      "resume_url",
      "candidate_email",
      "recruiter's_email",
      "job_description",
    ])

    console.log("Sending cold mail request to N8N:", {
      url: N8N_COLD_MAIL_URL,
      payload: {
        ...n8nPayload,
        candidate_email: "***@***.***", // Mask email in logs
        recruiter_email: "***@***.***", // Mask email in logs
      },
      contentType: "multipart/form-data",
    })

    // Send request to N8N as multipart/form-data.
    // We intentionally do NOT set the Content-Type header so that
    // fetch can add the correct boundary for the form-data body.
    const n8nResponse = await fetch(N8N_COLD_MAIL_URL, {
      method: "POST",
      body: formData,
    })

    console.log("N8N response received:", {
      status: n8nResponse.status,
      statusText: n8nResponse.statusText,
      headers: Object.fromEntries(n8nResponse.headers.entries())
    })

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text().catch(() => "Unknown error")
      console.error("N8N cold mail request failed:", {
        status: n8nResponse.status,
        statusText: n8nResponse.statusText,
        error: errorText
      })
      
      return NextResponse.json({
        message: `Cold mail service error: ${n8nResponse.status} ${n8nResponse.statusText}`,
        ...(process.env.NODE_ENV !== "production" && { 
          debug: { error: errorText } 
        })
      }, { status: 502 })
    }

    const n8nResult = await n8nResponse.json().catch(() => ({}))
    console.log("N8N cold mail response body:", n8nResult)

    return NextResponse.json({
      message: "Cold mail initiated successfully",
      n8n_response: n8nResult
    })

  } catch (error) {
    console.error("Cold mail API error:", error)
    
    const err = error as unknown as { message?: string; stack?: string }
    return NextResponse.json({
      message: "Internal server error",
      ...(process.env.NODE_ENV !== "production" && { 
        debug: { message: err?.message, stack: err?.stack } 
      })
    }, { status: 500 })
  }
}
