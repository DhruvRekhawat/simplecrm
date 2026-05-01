import { NextResponse } from "next/server"
import { z } from "zod"
import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { Page } from "@/lib/models/page"
import { requireSession, UnauthorizedError } from "@/lib/session"

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

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  icon: z.string().trim().max(8).optional(),
  starred: z.boolean().optional(),
  statusOptions: z.array(z.string().trim().min(1)).optional(),
  titleField: z.string().optional(),
  dedupField: z.string().optional(),
  schema: z.array(fieldSchema).optional(),
})

function badId() {
  return NextResponse.json({ error: "Invalid id" }, { status: 400 })
}

async function loadOwnedPage(id: string, uid: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  await connectDB()
  return await Page.findOne({
    _id: new mongoose.Types.ObjectId(id),
    userId: new mongoose.Types.ObjectId(uid),
  })
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ pageId: string }> }
) {
  try {
    const session = await requireSession()
    const { pageId } = await ctx.params
    if (!mongoose.Types.ObjectId.isValid(pageId)) return badId()
    const page = await loadOwnedPage(pageId, session.uid)
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ page })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ pageId: string }> }
) {
  try {
    const session = await requireSession()
    const { pageId } = await ctx.params
    if (!mongoose.Types.ObjectId.isValid(pageId)) return badId()

    const json = await req.json().catch(() => null)
    const parsed = patchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const page = await loadOwnedPage(pageId, session.uid)
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { schema, ...rest } = parsed.data
    Object.assign(page, rest)
    if (schema !== undefined) page.set("schema", schema)
    await page.save()
    return NextResponse.json({ page })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ pageId: string }> }
) {
  try {
    const session = await requireSession()
    const { pageId } = await ctx.params
    if (!mongoose.Types.ObjectId.isValid(pageId)) return badId()

    const page = await loadOwnedPage(pageId, session.uid)
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Cascade-delete records (the Record model is added in Phase 3 — guard for now)
    try {
      const Record = mongoose.models.Record
      if (Record) {
        await Record.deleteMany({ pageId: page._id })
      }
    } catch {
      // ignore
    }

    await page.deleteOne()
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}
