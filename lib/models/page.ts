import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose"

export const DEFAULT_STATUS_OPTIONS = [
  "new",
  "contacted",
  "interested",
  "not_interested",
  "converted",
  "junk",
]

const schemaFieldSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, required: true },
    visible: { type: Boolean, default: true },
    pinned: { type: Boolean, default: false },
  },
  { _id: false }
)

const pageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: "" },
    starred: { type: Boolean, default: false },
    schema: { type: [schemaFieldSchema], default: [] },
    titleField: { type: String, default: "" },
    dedupField: { type: String, default: "" },
    statusOptions: { type: [String], default: DEFAULT_STATUS_OPTIONS },
  },
  { timestamps: true }
)

pageSchema.index({ userId: 1, starred: -1, updatedAt: -1 })

export type PageDoc = InferSchemaType<typeof pageSchema> & {
  _id: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export const Page: Model<PageDoc> =
  (mongoose.models.Page as Model<PageDoc>) ||
  mongoose.model<PageDoc>("Page", pageSchema)
