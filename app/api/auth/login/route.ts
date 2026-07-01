import { type NextRequest, NextResponse } from "next/server"

import { createAuthToken, setAuthCookie, type AuthUser } from "@/lib/auth"
import { getDb } from "@/lib/mongodb"
import { verifyPassword } from "@/lib/password"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password required" }, { status: 400 })
    }

    let db
    try {
      db = await getDb("resumeiq")
    } catch (error) {
      const err = error as Error
      console.error("[Login] DB connection error:", err.message)
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

    const existingUser = await users.findOne(
      { email: String(email).toLowerCase() },
      { projection: { _id: 1, email: 1, name: 1, passwordHash: 1 } },
    )

    if (!existingUser?.passwordHash) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })
    }

    const ok = verifyPassword(String(password), String(existingUser.passwordHash))
    if (!ok) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })
    }

    const user: AuthUser = {
      userId: existingUser._id.toString(),
      email: String(existingUser.email),
      name: existingUser.name ? String(existingUser.name) : undefined,
    }

    const token = createAuthToken(user)

    const res = NextResponse.json({ token, user })
    setAuthCookie(res, token)
    return res
  } catch (error) {
    console.error("Login error:", error)
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
