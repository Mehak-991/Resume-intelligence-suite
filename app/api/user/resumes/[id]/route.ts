import { NextResponse, type NextRequest } from "next/server"
import { ObjectId } from "mongodb"

import clientPromise from "@/lib/mongodb"
import { getUserFromRequest } from "@/lib/auth"

export const runtime = "nodejs"

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id } = await ctx.params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 })
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
  const resumes = db.collection("resumes")

  const item = await resumes.findOne(
    { _id: new ObjectId(id), userId: user.userId },
    {
      projection: {
        fileName: 1,
        createdAt: 1,
        atsScore: 1,
        jdText: 1,
        recruiterEmail: 1,
        resumeUrl: 1,
        parsed: 1,
        optimizedResume: 1,
      },
    },
  )

  if (!item) {
    return NextResponse.json({ message: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ item })
}
