import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"

// TODO: Implement proper JWT verification
// TODO: Add role-based access control (RBAC)
// TODO: Add refresh token logic

export function proxy(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value

  // Protected routes that require authentication
  const protectedRoutes = ["/dashboard", "/profile"]

  const isProtectedRoute = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route))

  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*"],
}
