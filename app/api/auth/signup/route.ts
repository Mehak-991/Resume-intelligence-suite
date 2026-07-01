import { type NextRequest, NextResponse } from "next/server"

import { createAuthToken, setAuthCookie, type AuthUser } from "@/lib/auth"
import { getDb } from "@/lib/mongodb"
import { hashPassword } from "@/lib/password"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ message: "All fields are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters" }, { status: 400 })
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Invalid email address" }, { status: 400 })
    }

    let db
    try {
      db = await getDb("resumeiq")
    } catch (error) {
      const err = error as Error
      console.error("[Signup] DB connection error:", err.message)
      return NextResponse.json(
        {
          message: err.message || "Database connection failed",
          ...(process.env.NODE_ENV !== "production"
            ? { debug: err.message }
            : {}),
        },
        { status: 503 },
      )
    }

    const users = db.collection("users")

    const existingUser = await users.findOne({ email: email.toLowerCase() }, { projection: { _id: 1 } })
    if (existingUser) {
      return NextResponse.json({ message: "Email already registered" }, { status: 409 })
    }

    const passwordHash = hashPassword(password)
    const insertRes = await users.insertOne({
      name,
      email: email.toLowerCase(),
      passwordHash,
      createdAt: new Date(),
    })

    const user: AuthUser = { userId: insertRes.insertedId.toString(), email: email.toLowerCase(), name }
    const token = createAuthToken(user)

    const res = NextResponse.json({ token, user })
    setAuthCookie(res, token)
    return res
  } catch (error) {
    console.error("Signup error:", error)
    const err = error as Error
    return NextResponse.json(
      {
        message: "Internal server error",
        ...(process.env.NODE_ENV !== "production" ? { debug: err.message } : {}),
      },
      { status: 500 },
    )
  }
}
