import { type NextRequest, NextResponse } from "next/server"

import { createAuthToken, setAuthCookie, type AuthUser } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { verifyPassword } from "@/lib/password"

export const runtime = "nodejs"

// TODO: Replace with actual database integration (MongoDB Atlas)
// TODO: Use bcrypt to verify hashed passwords
// TODO: Add rate limiting for security

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    // TODO: Query database for user
    // const user = await User.findOne({ email })
    // if (!user) return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })

    // TODO: Verify password with bcrypt
    // const isValid = await bcrypt.compare(password, user.password)
    // if (!isValid) return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })

    // Mock authentication for development
    if (!email || !password) {
      return NextResponse.json({ message: "Email and password required" }, { status: 400 })
    }

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

    const res = NextResponse.json({
      token,
      user,
    })
    setAuthCookie(res, token)
    return res
  } catch (error) {
    console.error("Login error:", error)
    const err = error as unknown as { name?: string; message?: string; code?: string; cause?: { code?: string } }
    return NextResponse.json(
      {
        message: "Internal server error",
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
      { status: 500 },
    )
  }
}
