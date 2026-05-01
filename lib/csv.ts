function escape(value: unknown): string {
  if (value === null || value === undefined) return ""
  let s: string
  if (Array.isArray(value)) s = value.map((v) => String(v)).join(", ")
  else if (typeof value === "object") s = JSON.stringify(value)
  else s = String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escape).join(",")]
  for (const row of rows) lines.push(row.map(escape).join(","))
  return lines.join("\r\n")
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 0)
}
