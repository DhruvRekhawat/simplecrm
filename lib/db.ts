import mongoose from "mongoose"

const MONGO_URL = process.env.MONGO_URL
const DATABASE_NAME = process.env.DATABASE_NAME

if (!MONGO_URL) throw new Error("MONGO_URL env var is required")
if (!DATABASE_NAME) throw new Error("DATABASE_NAME env var is required")

type MongooseCache = {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

const globalWithMongoose = globalThis as typeof globalThis & {
  _mongoose?: MongooseCache
}

const cache: MongooseCache =
  globalWithMongoose._mongoose ?? { conn: null, promise: null }

if (!globalWithMongoose._mongoose) globalWithMongoose._mongoose = cache

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn
  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGO_URL!, {
      dbName: DATABASE_NAME,
      bufferCommands: false,
    })
  }
  cache.conn = await cache.promise
  return cache.conn
}
