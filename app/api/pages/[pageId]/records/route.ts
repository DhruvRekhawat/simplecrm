import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { Page } from "@/lib/models/page"
import { RecordModel } from "@/lib/models/record"
import { requireSession, UnauthorizedError } from "@/lib/session"
import { buildMongoQuery, parseFilters } from "@/lib/filter-builder"
import type { SchemaField } from "@/lib/schema-detector"

export async function GET(
  req: Request,
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

    const url = new URL(req.url)
    const search = url.searchParams.get("search") ?? ""
    const pageNum = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1)
    const limit = Math.min(
      500,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50)
    )
    const sort = url.searchParams.get("sort") || ""
    const sortDir = (url.searchParams.get("sortDir") || "asc") === "desc" ? -1 : 1
    const filters = parseFilters(url.searchParams.get("filters"))

    const status = url.searchParams.getAll("status")
    const scoreMin = parseInt(url.searchParams.get("scoreMin") ?? "0", 10) || 0
    const starredParam = url.searchParams.get("starred")
    const starred =
      starredParam === "true" ? true : starredParam === "false" ? false : undefined

    const query = buildMongoQuery(
      page.schema as SchemaField[],
      filters,
      { status: status.length ? status : undefined, scoreMin, starred },
      { titleField: page.titleField, query: search }
    )
    query.pageId = page._id

    let mongoSort: Record<string, 1 | -1> = { _id: -1 }
    if (sort === "__system__status") mongoSort = { status: sortDir }
    else if (sort === "__system__score") mongoSort = { score: sortDir }
    else if (sort === "__system__starred") mongoSort = { starred: sortDir }
    else if (sort) mongoSort = { [`data.${sort}`]: sortDir }

    const [records, total] = await Promise.all([
      RecordModel.find(query)
        .sort(mongoSort)
        .skip((pageNum - 1) * limit)
        .limit(limit)
        .lean(),
      RecordModel.countDocuments(query),
    ])

    return NextResponse.json({
      records,
      total,
      page: pageNum,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}
