import mongoose, { Schema, type Model } from "mongoose"

const noteSchema = new Schema(
  {
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
)

const recordSchema = new Schema(
  {
    pageId: { type: Schema.Types.ObjectId, ref: "Page", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    data: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, default: "new" },
    score: { type: Number, default: 0, min: 0, max: 5 },
    notes: { type: [noteSchema], default: [] },
    tags: { type: [String], default: [] },
    starred: { type: Boolean, default: false },
  },
  { timestamps: true, minimize: false }
)

recordSchema.index({ pageId: 1, status: 1 })
recordSchema.index({ pageId: 1, starred: -1 })

export type RecordDoc = {
  _id: mongoose.Types.ObjectId
  pageId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  data: Record<string, unknown>
  status: string
  score: number
  notes: { _id: mongoose.Types.ObjectId; text: string; createdAt: Date }[]
  tags: string[]
  starred: boolean
  createdAt: Date
  updatedAt: Date
}

export const RecordModel: Model<RecordDoc> =
  (mongoose.models.Record as Model<RecordDoc>) ||
  mongoose.model<RecordDoc>("Record", recordSchema)
