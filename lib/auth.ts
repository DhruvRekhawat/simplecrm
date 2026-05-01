import { SignJWT, jwtVerify } from "jose"

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error("JWT_SECRET env var is required")

const secretKey = new TextEncoder().encode(JWT_SECRET)
const ALG = "HS256"

export const SESSION_COOKIE = "simplecrm_session"
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

export type SessionPayload = {
  uid: string
  username: string
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey)
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: [ALG] })
    if (typeof payload.uid === "string" && typeof payload.username === "string") {
      return { uid: payload.uid, username: payload.username }
    }
    return null
  } catch {
    return null
  }
}
