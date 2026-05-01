import type { SchemaField, FieldType } from "./schema-detector"

export type FilterValue =
  // string fields: substring search
  | { type: "text"; value: string }
  // number fields
  | { type: "range"; min?: number; max?: number }
  // array fields
  | { type: "in"; values: string[] }
  // phone/url/email — has / not
  | { type: "exists"; value: "yes" | "no" }
  // boolean
  | { type: "bool"; value: "yes" | "no" }

export type FilterMap = Record<string, FilterValue>

export type SystemFilters = {
  status?: string[]
  scoreMin?: number
  starred?: boolean
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function buildMongoQuery(
  schema: SchemaField[],
  filters: FilterMap,
  system: SystemFilters,
  search: { titleField?: string; query?: string }
): Record<string, unknown> {
  const query: Record<string, unknown> = {}

  // System
  if (system.status && system.status.length > 0) {
    query.status = { $in: system.status }
  }
  if (typeof system.scoreMin === "number" && system.scoreMin > 0) {
    query.score = { $gte: system.scoreMin }
  }
  if (typeof system.starred === "boolean") {
    query.starred = system.starred
  }

  // Search across title field
  if (search.titleField && search.query && search.query.trim()) {
    query[`data.${search.titleField}`] = {
      $regex: escapeRegex(search.query.trim()),
      $options: "i",
    }
  }

  // Per-field
  const byKey = new Map<string, FieldType>()
  for (const f of schema) byKey.set(f.key, f.type)

  for (const [key, filter] of Object.entries(filters)) {
    const path = `data.${key}`
    const type = byKey.get(key)
    if (!type) continue

    switch (filter.type) {
      case "text": {
        const v = filter.value.trim()
        if (!v) break
        query[path] = { $regex: escapeRegex(v), $options: "i" }
        break
      }
      case "range": {
        const cond: Record<string, number> = {}
        if (typeof filter.min === "number") cond.$gte = filter.min
        if (typeof filter.max === "number") cond.$lte = filter.max
        if (Object.keys(cond).length) query[path] = cond
        break
      }
      case "in": {
        if (filter.values.length === 0) break
        if (type === "array") {
          query[path] = { $in: filter.values }
        } else {
          query[path] = { $in: filter.values }
        }
        break
      }
      case "exists": {
        if (filter.value === "yes") {
          query[path] = { $exists: true, $nin: [null, ""] }
        } else {
          query[path] = { $in: [null, "", undefined] }
        }
        break
      }
      case "bool": {
        query[path] = filter.value === "yes"
        break
      }
    }
  }

  return query
}

export function parseFilters(input: string | null | undefined): FilterMap {
  if (!input) return {}
  try {
    const parsed = JSON.parse(input)
    if (parsed && typeof parsed === "object") return parsed as FilterMap
    return {}
  } catch {
    return {}
  }
}
