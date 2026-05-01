import { NextResponse } from "next/server"
import { z } from "zod"
import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { Page, DEFAULT_STATUS_OPTIONS } from "@/lib/models/page"
import { requireSession, UnauthorizedError } from "@/lib/session"

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  icon: z.string().trim().max(8).optional(),
})

export async function GET(req: Request) {
  try {
    const session = await requireSession()
    await connectDB()
    const url = new URL(req.url)
    const onlyStarred = url.searchParams.get("starred") === "1"

    const userId = new mongoose.Types.ObjectId(session.uid)
    const match: Record<string, unknown> = { userId }
    if (onlyStarred) match.starred = true

    // Aggregate record counts via lookup
    const pages = await Page.aggregate([
      { $match: match },
      { $sort: { starred: -1, updatedAt: -1 } },
      {
        $lookup: {
          from: "records",
          localField: "_id",
          foreignField: "pageId",
          as: "_records",
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $addFields: {
          recordCount: { $size: "$_records" },
        },
      },
      { $project: { _records: 0, schema: 0 } },
    ])

    return NextResponse.json({ pages })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession()
    const json = await req.json().catch(() => null)
    const parsed = createSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
    await connectDB()
    const page = await Page.create({
      userId: new mongoose.Types.ObjectId(session.uid),
      name: parsed.data.name,
      icon: parsed.data.icon ?? "",
      starred: false,
      schema: [],
      titleField: "",
      dedupField: "",
      statusOptions: DEFAULT_STATUS_OPTIONS,
    })
    return NextResponse.json({ page })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}
