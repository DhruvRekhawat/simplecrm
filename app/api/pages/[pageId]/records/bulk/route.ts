import { NextResponse } from "next/server"
import { z } from "zod"
import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { Page } from "@/lib/models/page"
import { RecordModel } from "@/lib/models/record"
import { requireSession, UnauthorizedError } from "@/lib/session"
import { buildMongoQuery, parseFilters, type FilterMap } from "@/lib/filter-builder"
import type { SchemaField } from "@/lib/schema-detector"

const bodySchema = z.object({
  ids: z.array(z.string()).optional(),
  // Or apply to all matching current filters
  scope: z
    .object({
      search: z.string().optional(),
      filters: z.unknown().optional(),
      status: z.array(z.string()).optional(),
      scoreMin: z.number().optional(),
    })
    .optional(),
  action: z.enum(["set_status", "set_score", "add_tag", "delete"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
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
    const userId = new mongoose.Types.ObjectId(session.uid)
    const pageObjectId = new mongoose.Types.ObjectId(pageId)
    const page = await Page.findOne({ _id: pageObjectId, userId })
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 })

    let filter: Record<string, unknown> = { pageId: pageObjectId, userId }

    if (parsed.data.ids && parsed.data.ids.length > 0) {
      const ids = parsed.data.ids.filter((id) => mongoose.Types.ObjectId.isValid(id))
      filter._id = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) }
    } else if (parsed.data.scope) {
      const filters = parseFilters(
        typeof parsed.data.scope.filters === "string"
          ? parsed.data.scope.filters
          : JSON.stringify(parsed.data.scope.filters ?? {})
      ) as FilterMap
      const built = buildMongoQuery(
        page.schema as SchemaField[],
        filters,
        {
          status: parsed.data.scope.status?.length ? parsed.data.scope.status : undefined,
          scoreMin: parsed.data.scope.scoreMin ?? 0,
        },
        { titleField: page.titleField, query: parsed.data.scope.search }
      )
      filter = { ...built, pageId: pageObjectId, userId }
    } else {
      return NextResponse.json({ error: "ids or scope required" }, { status: 400 })
    }

    let result: { matchedCount?: number; modifiedCount?: number; deletedCount?: number }

    switch (parsed.data.action) {
      case "set_status": {
        const v = parsed.data.value
        if (typeof v !== "string") {
          return NextResponse.json({ error: "value must be string" }, { status: 400 })
        }
        result = await RecordModel.updateMany(filter, { $set: { status: v } })
        break
      }
      case "set_score": {
        const v = parsed.data.value
        const score = typeof v === "number" ? v : Number(v)
        if (!Number.isInteger(score) || score < 0 || score > 5) {
          return NextResponse.json({ error: "score must be 0-5" }, { status: 400 })
        }
        result = await RecordModel.updateMany(filter, { $set: { score } })
        break
      }
      case "add_tag": {
        const v = parsed.data.value
        const tag = typeof v === "string" ? v : Array.isArray(v) ? v[0] : ""
        if (!tag) {
          return NextResponse.json({ error: "tag required" }, { status: 400 })
        }
        result = await RecordModel.updateMany(filter, { $addToSet: { tags: tag } })
        break
      }
      case "delete": {
        result = await RecordModel.deleteMany(filter)
        break
      }
    }

    return NextResponse.json({
      matched: result.matchedCount ?? 0,
      modified: result.modifiedCount ?? 0,
      deleted: result.deletedCount ?? 0,
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}
