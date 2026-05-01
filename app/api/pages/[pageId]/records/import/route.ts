import { NextResponse } from "next/server"
import { z } from "zod"
import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { Page } from "@/lib/models/page"
import { RecordModel } from "@/lib/models/record"
import { requireSession, UnauthorizedError } from "@/lib/session"
import { flattenForStorage, type FieldType, type SchemaField } from "@/lib/schema-detector"
import { normalizeByType } from "@/lib/dedup"

const fieldSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  type: z.enum([
    "string",
    "number",
    "boolean",
    "phone",
    "url",
    "email",
    "array",
    "json",
  ]),
  visible: z.boolean(),
  pinned: z.boolean().default(false),
})

const bodySchema = z.object({
  records: z.array(z.record(z.string(), z.unknown())).min(1),
  schema: z.array(fieldSchema),
  titleField: z.string().default(""),
  dedupField: z.string().default(""),
  mode: z.enum(["new_only", "upsert"]).default("new_only"),
})

const BATCH_SIZE = 500

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
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 }
      )
    }

    await connectDB()
    const userId = new mongoose.Types.ObjectId(session.uid)
    const page = await Page.findOne({
      _id: new mongoose.Types.ObjectId(pageId),
      userId,
    })
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const incoming = parsed.data.records.map((r) => flattenForStorage(r))

    // Merge schema: existing wins; new keys appended hidden by default
    const existingByKey = new Map<string, SchemaField>()
    for (const f of page.schema as SchemaField[]) existingByKey.set(f.key, f)

    let newColumns: string[] = []
    let mergedSchema: SchemaField[]
    let mergedTitle = page.titleField
    let mergedDedup = page.dedupField

    if (existingByKey.size === 0) {
      // First import — adopt incoming schema as-is
      mergedSchema = parsed.data.schema as SchemaField[]
      mergedTitle = parsed.data.titleField || ""
      mergedDedup = parsed.data.dedupField || ""
    } else {
      mergedSchema = [...(page.schema as SchemaField[])]
      for (const f of parsed.data.schema as SchemaField[]) {
        if (!existingByKey.has(f.key)) {
          mergedSchema.push({ ...f, visible: false })
          newColumns.push(f.key)
        }
      }
    }

    const dedupField = mergedDedup
    const dedupType: FieldType =
      mergedSchema.find((f) => f.key === dedupField)?.type ?? "string"

    let inserted = 0
    let updated = 0
    let skipped = 0

    if (dedupField) {
      // Build map of existing normalized values → record _id
      const existingDocs = await RecordModel.find(
        { pageId: page._id },
        { _id: 1, [`data.${dedupField}`]: 1 }
      ).lean()

      const existingMap = new Map<string, mongoose.Types.ObjectId>()
      for (const d of existingDocs) {
        const v = (d.data as Record<string, unknown> | undefined)?.[dedupField]
        const norm = normalizeByType(v, dedupType)
        if (norm) existingMap.set(norm, d._id as mongoose.Types.ObjectId)
      }

      const toInsert: Record<string, unknown>[] = []
      const toUpdate: { id: mongoose.Types.ObjectId; data: Record<string, unknown> }[] = []
      const seenInBatch = new Set<string>()

      for (const r of incoming) {
        const norm = normalizeByType(r[dedupField], dedupType)
        if (!norm) {
          // No dedup value — treat as new
          toInsert.push(r)
          continue
        }
        if (seenInBatch.has(norm)) {
          skipped++
          continue
        }
        seenInBatch.add(norm)
        const existingId = existingMap.get(norm)
        if (existingId) {
          if (parsed.data.mode === "upsert") {
            toUpdate.push({ id: existingId, data: r })
          } else {
            skipped++
          }
        } else {
          toInsert.push(r)
        }
      }

      // Batch insert
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE)
        const docs = batch.map((data) => ({
          pageId: page._id,
          userId,
          data,
          status: "new",
          score: 0,
          notes: [],
          tags: [],
          starred: false,
        }))
        const result = await RecordModel.insertMany(docs, { ordered: false })
        inserted += result.length
      }

      // Updates (only data field) — done one-by-one for simplicity at v1 scale
      if (toUpdate.length > 0) {
        const ops = toUpdate.map((u) => ({
          updateOne: {
            filter: { _id: u.id, pageId: page._id, userId },
            update: { $set: { data: u.data } },
          },
        }))
        for (let i = 0; i < ops.length; i += BATCH_SIZE) {
          const slice = ops.slice(i, i + BATCH_SIZE)
          const result = await RecordModel.bulkWrite(slice, { ordered: false })
          updated += result.modifiedCount ?? 0
        }
      }
    } else {
      // No dedup — insert everything
      for (let i = 0; i < incoming.length; i += BATCH_SIZE) {
        const batch = incoming.slice(i, i + BATCH_SIZE)
        const docs = batch.map((data) => ({
          pageId: page._id,
          userId,
          data,
          status: "new",
          score: 0,
          notes: [],
          tags: [],
          starred: false,
        }))
        const result = await RecordModel.insertMany(docs, { ordered: false })
        inserted += result.length
      }
    }

    // Persist schema changes
    page.set("schema", mergedSchema)
    if (!page.titleField && mergedTitle) page.titleField = mergedTitle
    if (!page.dedupField && mergedDedup) page.dedupField = mergedDedup
    await page.save()

    return NextResponse.json({
      inserted,
      updated,
      skipped,
      newColumns,
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}
