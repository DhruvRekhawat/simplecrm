import { generateLabel } from "./label-generator"

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "phone"
  | "url"
  | "email"
  | "array"
  | "json"

export type SchemaField = {
  key: string
  label: string
  type: FieldType
  visible: boolean
  pinned: boolean
}

const PHONE_RE = /^[+(]\s?\d[\d\s\-().]{5,18}\d$/
const URL_RE = /^https?:\/\//i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const TITLE_KEYS = ["title", "name", "company", "business", "label", "heading"]
const DEDUP_KEYS = ["phone", "email", "placeid", "place_id", "id"]
const HIDE_KEYS = new Set(["placeid", "place_id", "countrycode", "country_code"])

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
}

function flattenRecord(rec: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rec)) {
    if (isPlainObject(v)) {
      let hasNestedObject = false
      for (const [k2, v2] of Object.entries(v)) {
        if (isPlainObject(v2)) {
          hasNestedObject = true
          break
        }
      }
      if (hasNestedObject) {
        // Deeper than one level — keep as json
        out[k] = v
      } else {
        for (const [k2, v2] of Object.entries(v)) {
          out[`${k}.${k2}`] = v2
        }
      }
    } else {
      out[k] = v
    }
  }
  return out
}

function detectValueType(v: unknown): FieldType | null {
  if (v === null || v === undefined || v === "") return null
  if (typeof v === "boolean") return "boolean"
  if (typeof v === "number" && Number.isFinite(v)) return "number"
  if (Array.isArray(v)) return "array"
  if (typeof v === "string") {
    if (PHONE_RE.test(v.trim())) return "phone"
    if (URL_RE.test(v.trim())) return "url"
    if (EMAIL_RE.test(v.trim())) return "email"
    return "string"
  }
  if (isPlainObject(v)) return "json"
  return "string"
}

export type DetectionResult = {
  schema: SchemaField[]
  titleField: string
  dedupField: string
}

export function detectSchema(records: Record<string, unknown>[]): DetectionResult {
  const flattened = records.map((r) => flattenRecord(r))

  // Step 1: collect keys preserving first-seen order
  const keyOrder: string[] = []
  const seen = new Set<string>()
  for (const r of flattened) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k)
        keyOrder.push(k)
      }
    }
  }

  // Step 2: type inference per key
  const types: Record<string, FieldType> = {}
  const nullCounts: Record<string, number> = {}
  const totalCounts: Record<string, number> = {}

  for (const k of keyOrder) {
    const counts: Partial<Record<FieldType, number>> = {}
    let nonNull = 0
    let nullCount = 0
    const total = flattened.length
    for (const r of flattened) {
      const v = r[k]
      const t = detectValueType(v)
      if (t === null) {
        nullCount++
        continue
      }
      nonNull++
      counts[t] = (counts[t] ?? 0) + 1
    }
    totalCounts[k] = total
    nullCounts[k] = nullCount

    if (nonNull === 0) {
      types[k] = "string"
      continue
    }
    const distinctTypes = Object.keys(counts) as FieldType[]
    if (distinctTypes.length === 1) {
      types[k] = distinctTypes[0]
    } else {
      // Mixed types — fall back to string
      types[k] = "string"
    }
  }

  // Step 3: title field
  let titleField = ""
  for (const k of keyOrder) {
    const last = k.split(".").pop()!.toLowerCase()
    if (TITLE_KEYS.includes(last)) {
      titleField = k
      break
    }
  }
  if (!titleField) {
    for (const k of keyOrder) {
      if (types[k] === "string") {
        titleField = k
        break
      }
    }
  }

  // Step 4: dedup field
  let dedupField = ""
  for (const k of keyOrder) {
    const last = k.split(".").pop()!.toLowerCase()
    if (DEDUP_KEYS.includes(last)) {
      dedupField = k
      break
    }
  }

  // Step 5+6: build schema with labels and visibility defaults
  const schema: SchemaField[] = keyOrder.map((k) => {
    const last = k.split(".").pop()!.toLowerCase()
    const type = types[k]
    const total = totalCounts[k] || 1
    const nullRatio = nullCounts[k] / total
    let visible = true
    if (type === "json") visible = false
    if (HIDE_KEYS.has(last)) visible = false
    if (nullRatio > 0.8) visible = false
    return {
      key: k,
      label: generateLabel(k),
      type,
      visible,
      pinned: false,
    }
  })

  return { schema, titleField, dedupField }
}

export function flattenForStorage(rec: Record<string, unknown>): Record<string, unknown> {
  return flattenRecord(rec)
}
