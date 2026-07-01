import { type NextRequest, NextResponse } from "next/server"

import { createAuthToken, setAuthCookie, type AuthUser } from "@/lib/auth"
import { getDb } from "@/lib/mongodb"
import { verifyPassword } from "@/lib/password"

export const runtime = "nodejs"

const isDev = process.env.NODE_ENV !== "production"

export async function POST(req: NextRequest) {
  console.log("[Login] Request received")

  try {
    // ── Parse body ──────────────────────────────────────────────────
    let email: string, password: string
    try {
      const body = await req.json()
      email = body.email
      password = body.password
      console.log("[Login] Body parsed — email:", email)
    } catch (parseErr) {
      console.error("[Login] Body parse error:", parseErr)
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
    }

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password required" }, { status: 400 })
    }

    // ── Connect to MongoDB ──────────────────────────────────────────
    console.log("[Login] Connecting to MongoDB...")
    let db
    try {
      db = await getDb("resumeiq")
      console.log("[Login] MongoDB connected ✅")
    } catch (error) {
      const err = error as Error
      console.error("[Login] DB connection error:", err.message)
      return NextResponse.json(
        {
          message: err.message || "Database connection failed",
          ...(isDev ? { debug: err.message, stack: err.stack } : {}),
        },
        { status: 503 },
      )
    }

    // ── Find user ───────────────────────────────────────────────────
    console.log("[Login] Looking up user...")
    const users = db.collection("users")
    const existingUser = await users.findOne(
      { email: String(email).toLowerCase() },
      { projection: { _id: 1, email: 1, name: 1, passwordHash: 1 } },
    )

    if (!existingUser?.passwordHash) {
      console.log("[Login] User not found or no password hash")
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })
    }

    // ── Verify password ─────────────────────────────────────────────
    console.log("[Login] Verifying password...")
    const ok = verifyPassword(String(password), String(existingUser.passwordHash))
    if (!ok) {
      console.log("[Login] Password mismatch")
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })
    }

    // ── Generate JWT ────────────────────────────────────────────────
    console.log("[Login] Generating JWT...")
    const user: AuthUser = {
      userId: existingUser._id.toString(),
      email: String(existingUser.email),
      name: existingUser.name ? String(existingUser.name) : undefined,
    }
    const token = createAuthToken(user)

    console.log("[Login] Returning success response ✅")
    const res = NextResponse.json({ success: true, token, user })
    setAuthCookie(res, token)
    return res

  } catch (error) {
    console.error("[Login] Unhandled error:", error)
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
