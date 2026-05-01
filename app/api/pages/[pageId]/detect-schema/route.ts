import { NextResponse } from "next/server"
import { z } from "zod"
import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { Page } from "@/lib/models/page"
import { requireSession, UnauthorizedError } from "@/lib/session"
import { detectSchema, flattenForStorage } from "@/lib/schema-detector"

const bodySchema = z.object({
  records: z.array(z.record(z.string(), z.unknown())).max(2000),
})

export async function POST(
  req: Request,
  ctx: { params: Promise<{ pageId: string }> }
) {
  try {
    const session = await requireSession()
    const { pageId } = await ctx.params
    if (!mongoose.Types.ObjectId.isValid(pageId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const json = await req.json().catch(() => null)
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    await connectDB()
    const page = await Page.findOne({
      _id: new mongoose.Types.ObjectId(pageId),
      userId: new mongoose.Types.ObjectId(session.uid),
    })
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const detection = detectSchema(parsed.data.records)
    const preview = parsed.data.records.slice(0, 5).map((r) => flattenForStorage(r))

    return NextResponse.json({
      detected: detection,
      existingSchema: page.schema,
      hasExistingRecords: page.schema && page.schema.length > 0,
      titleField: page.titleField,
      dedupField: page.dedupField,
      preview,
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}
