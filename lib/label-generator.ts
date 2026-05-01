const ABBREVIATIONS = new Set(["url", "id", "uri", "uuid", "ip", "api", "ui", "css", "html", "json", "xml", "csv", "sku", "asin", "isbn", "vat", "ssn", "ein", "gst", "pin"])

function titleCaseWord(w: string): string {
  if (!w) return w
  if (ABBREVIATIONS.has(w.toLowerCase())) return w.toUpperCase()
  return w[0].toUpperCase() + w.slice(1).toLowerCase()
}

export function generateLabel(key: string): string {
  if (!key) return ""
  // Take last segment for dot.notation paths
  const segments = key.split(".")
  const last = segments[segments.length - 1]

  // Split camelCase, snake_case, kebab-case
  const parts = last
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_\-]+/)
    .filter(Boolean)

  return parts.map(titleCaseWord).join(" ")
}
