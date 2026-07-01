import { type NextRequest, NextResponse } from "next/server"

import { createAuthToken, setAuthCookie, type AuthUser } from "@/lib/auth"
import { getDb } from "@/lib/mongodb"
import { hashPassword } from "@/lib/password"

export const runtime = "nodejs"

const isDev = process.env.NODE_ENV !== "production"

export async function POST(req: NextRequest) {
  console.log("[Signup] Request received")

  try {
    // ── Parse body ──────────────────────────────────────────────────
    let name: string, email: string, password: string
    try {
      const body = await req.json()
      name = body.name
      email = body.email
      password = body.password
      console.log("[Signup] Body parsed — email:", email)
    } catch (parseErr) {
      console.error("[Signup] Body parse error:", parseErr)
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
    }

    // ── Validate fields ─────────────────────────────────────────────
    if (!name || !email || !password) {
      return NextResponse.json({ message: "All fields are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters" }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Invalid email address" }, { status: 400 })
    }

    // ── Connect to MongoDB ──────────────────────────────────────────
    console.log("[Signup] Connecting to MongoDB...")
    let db
    try {
      db = await getDb("resumeiq")
      console.log("[Signup] MongoDB connected ✅")
    } catch (error) {
      const err = error as Error
      console.error("[Signup] DB connection error:", err.message)
      return NextResponse.json(
        {
          message: err.message || "Database connection failed",
          ...(isDev ? { debug: err.message, stack: err.stack } : {}),
        },
        { status: 503 },
      )
    }

    // ── Check existing user ─────────────────────────────────────────
    console.log("[Signup] Checking for existing user...")
    const users = db.collection("users")
    const existingUser = await users.findOne(
      { email: email.toLowerCase() },
      { projection: { _id: 1 } },
    )
    if (existingUser) {
      console.log("[Signup] Email already registered:", email)
      return NextResponse.json({ message: "Email already registered" }, { status: 409 })
    }

    // ── Hash password ───────────────────────────────────────────────
    console.log("[Signup] Hashing password...")
    const passwordHash = hashPassword(password)

    // ── Create user ─────────────────────────────────────────────────
    console.log("[Signup] Creating user in MongoDB...")
    const insertRes = await users.insertOne({
      name,
      email: email.toLowerCase(),
      passwordHash,
      createdAt: new Date(),
    })
    console.log("[Signup] User created — insertedId:", insertRes.insertedId.toString())

    // ── Generate JWT ────────────────────────────────────────────────
    console.log("[Signup] Generating JWT...")
    const user: AuthUser = {
      userId: insertRes.insertedId.toString(),
      email: email.toLowerCase(),
      name,
    }
    const token = createAuthToken(user)

    // ── Return response ─────────────────────────────────────────────
    console.log("[Signup] Returning success response ✅")
    const res = NextResponse.json({ success: true, token, user })
    setAuthCookie(res, token)
    return res

  } catch (error) {
    console.error("[Signup] Unhandled error:", error)
    const err = error as Error
    return NextResponse.json(
      {
        success: false,
        message: isDev
          ? (err.message || "Internal server error")
          : "Internal server error",
        ...(isDev ? { debug: err.message, stack: err.stack } : {}),
      },
      { status: 500 },
    )
  }
}
