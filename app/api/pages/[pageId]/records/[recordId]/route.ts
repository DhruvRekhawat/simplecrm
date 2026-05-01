import { NextResponse } from "next/server"
import { z } from "zod"
import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { RecordModel } from "@/lib/models/record"
import { requireSession, UnauthorizedError } from "@/lib/session"

const patchSchema = z.object({
  status: z.string().min(1).optional(),
  score: z.number().int().min(0).max(5).optional(),
  starred: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  addNote: z.string().min(1).max(5000).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

function badId() {
  return NextResponse.json({ error: "Invalid id" }, { status: 400 })
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ pageId: string; recordId: string }> }
) {
  try {
    const session = await requireSession()
    const { pageId, recordId } = await ctx.params
    if (
      !mongoose.Types.ObjectId.isValid(pageId) ||
      !mongoose.Types.ObjectId.isValid(recordId)
    ) {
      return badId()
    }

    const json = await req.json().catch(() => null)
    const parsed = patchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    await connectDB()
    const userId = new mongoose.Types.ObjectId(session.uid)
    const filter = {
      _id: new mongoose.Types.ObjectId(recordId),
      pageId: new mongoose.Types.ObjectId(pageId),
      userId,
    }

    const update: Record<string, unknown> = {}
    const set: Record<string, unknown> = {}
    if (parsed.data.status !== undefined) set.status = parsed.data.status
    if (parsed.data.score !== undefined) set.score = parsed.data.score
    if (parsed.data.starred !== undefined) set.starred = parsed.data.starred
    if (parsed.data.tags !== undefined) set.tags = parsed.data.tags
    if (parsed.data.data !== undefined) set.data = parsed.data.data
    if (Object.keys(set).length > 0) update.$set = set

    if (parsed.data.addNote) {
      update.$push = {
        notes: { text: parsed.data.addNote, createdAt: new Date() },
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const record = await RecordModel.findOneAndUpdate(filter, update, { new: true })
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ record })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ pageId: string; recordId: string }> }
) {
  try {
    const session = await requireSession()
    const { pageId, recordId } = await ctx.params
    if (
      !mongoose.Types.ObjectId.isValid(pageId) ||
      !mongoose.Types.ObjectId.isValid(recordId)
    ) {
      return badId()
    }
    await connectDB()
    const result = await RecordModel.deleteOne({
      _id: new mongoose.Types.ObjectId(recordId),
      pageId: new mongoose.Types.ObjectId(pageId),
      userId: new mongoose.Types.ObjectId(session.uid),
    })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}
