import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE, verifySession } from "@/lib/auth"

export async function GET() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ user: null }, { status: 401 })

  const session = await verifySession(token)
  if (!session) return NextResponse.json({ user: null }, { status: 401 })

  return NextResponse.json({ user: { username: session.username } })
}
