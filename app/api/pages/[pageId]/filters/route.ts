import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { Page } from "@/lib/models/page"
import { RecordModel } from "@/lib/models/record"
import { requireSession, UnauthorizedError } from "@/lib/session"
import type { SchemaField } from "@/lib/schema-detector"

const MAX_DISTINCT = 50

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ pageId: string }> }
) {
  try {
    const session = await requireSession()
    const { pageId } = await ctx.params
    if (!mongoose.Types.ObjectId.isValid(pageId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }
    await connectDB()
    const userId = new mongoose.Types.ObjectId(session.uid)
    const page = await Page.findOne({
      _id: new mongoose.Types.ObjectId(pageId),
      userId,
    })
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const schema = page.schema as SchemaField[]
    const result: Record<
      string,
      { distinct?: string[]; min?: number; max?: number }
    > = {}

    await Promise.all(
      schema
        .filter((f) => f.visible)
        .map(async (f) => {
          const path = `data.${f.key}`
          if (f.type === "array" || f.type === "string") {
            try {
              const distinct = await RecordModel.aggregate([
                { $match: { pageId: page._id } },
                f.type === "array"
                  ? { $unwind: `$${path}` }
                  : { $project: { val: `$${path}` } },
                f.type === "array"
                  ? { $group: { _id: `$${path}` } }
                  : { $group: { _id: "$val" } },
                { $match: { _id: { $nin: [null, ""] } } },
                { $limit: MAX_DISTINCT + 1 },
              ])
              const values = distinct
                .map((d) => d._id)
                .filter((v): v is string => typeof v === "string")
                .slice(0, MAX_DISTINCT)
              if (values.length > 0 && values.length <= MAX_DISTINCT) {
                result[f.key] = { distinct: values.sort() }
              }
            } catch {
              /* ignore */
            }
          } else if (f.type === "number") {
            try {
              const stats = await RecordModel.aggregate([
                { $match: { pageId: page._id } },
                {
                  $group: {
                    _id: null,
                    min: { $min: `$${path}` },
                    max: { $max: `$${path}` },
                  },
                },
              ])
              const s = stats[0]
              if (s && typeof s.min === "number" && typeof s.max === "number") {
                result[f.key] = { min: s.min, max: s.max }
              }
            } catch {
              /* ignore */
            }
          }
        })
    )

    return NextResponse.json({ filters: result })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}
