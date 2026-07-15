import { type NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"

export interface AuthUser {
  userId: string
  email: string
  name?: string
}

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-for-dev"
const COOKIE_NAME = "auth_token"

export function createAuthToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" })
}

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: "/",
  })
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.delete(COOKIE_NAME)
}

export function getUserFromRequest(req: NextRequest): AuthUser | null {
  try {
    // 1. Try to get token from Authorization header
    let token = ""
    const authHeader = req.headers.get("Authorization")
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7)
    }

    // 2. Fallback to cookies if header is empty/invalid
    if (!token) {
      token = req.cookies.get(COOKIE_NAME)?.value || ""
    }

    if (!token) {
      return null
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser
    return decoded
  } catch (error) {
    console.error("Token verification failed:", error)
    return null
  }
}
