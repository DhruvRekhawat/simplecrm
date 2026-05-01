import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"

export async function GET() {
  try {
    const conn = await connectDB()
    return NextResponse.json({
      ok: true,
      db: conn.connection.db?.databaseName,
      readyState: conn.connection.readyState,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    )
  }
}
