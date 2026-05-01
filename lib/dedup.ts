import type { FieldType } from "./schema-detector"

export function normalizePhone(raw: string): string {
  let s = raw.replace(/[\s\-().]/g, "")
  // 091XXXXXXXXXX → +91XXXXXXXXXX
  if (/^0(\d{2,3})(\d{7,})$/.test(s)) {
    const m = s.match(/^0(\d{2,3})(\d{7,})$/)!
    s = `+${m[1]}${m[2]}`
  } else if (/^00(\d+)$/.test(s)) {
    s = `+${s.slice(2)}`
  } else if (/^\+/.test(s)) {
    // already prefixed
  } else if (/^91\d{10}$/.test(s)) {
    s = `+${s}`
  } else if (/^1\d{10}$/.test(s) && raw.includes("(")) {
    s = `+${s}`
  }
  return s
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function normalizeString(raw: string): string {
  return raw.trim().toLowerCase()
}

export function normalizeByType(raw: unknown, type: FieldType): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw)
  if (!s) return null
  switch (type) {
    case "phone":
      return normalizePhone(s)
    case "email":
      return normalizeEmail(s)
    default:
      return normalizeString(s)
  }
}
