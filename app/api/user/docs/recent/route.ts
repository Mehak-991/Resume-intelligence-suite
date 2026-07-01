import { NextResponse, type NextRequest } from "next/server"

import clientPromise from "@/lib/mongodb"
import { getUserFromRequest } from "@/lib/auth"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
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
  const items = await db
    .collection("docs")
    .find({ userId: user.userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .project({ source: 1, inputType: 1, createdAt: 1 })
    .toArray()

  return NextResponse.json({ items })
}
