"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { toCsv, downloadCsv } from "@/lib/csv"
import { buildRecordsUrl, type RecordsQuery, type RecordRow } from "@/hooks/use-records"
import type { SchemaField } from "@/lib/schema-detector"

const EXPORT_LIMIT = 5000

export function ExportButton({
  pageId,
  pageName,
  schema,
  query,
}: {
  pageId: string
  pageName: string
  schema: SchemaField[]
  query: Omit<RecordsQuery, "page" | "limit">
}) {
  const [loading, setLoading] = useState(false)

  async function exportCsv() {
    setLoading(true)
    try {
      const visible = schema.filter((f) => f.visible)
      const url = buildRecordsUrl(pageId, {
        ...query,
        page: 1,
        limit: EXPORT_LIMIT,
      })
      const res = await fetch(url)
      if (!res.ok) {
        toast.error("Export failed")
        return
      }
      const data: { records: RecordRow[]; total: number } = await res.json()
      if (data.total > EXPORT_LIMIT) {
        toast.warning(
          `Exporting first ${EXPORT_LIMIT} of ${data.total} records. Narrow your filters to export the rest.`
        )
      }
      const headers = [
        ...visible.map((f) => f.label),
        "Status",
        "Score",
        "Tags",
        "Starred",
      ]
      const rows = data.records.map((r) => [
        ...visible.map((f) => r.data?.[f.key]),
        r.status,
        r.score,
        r.tags.join(", "),
        r.starred ? "yes" : "no",
      ])
      const csv = toCsv(headers, rows)
      const date = new Date().toISOString().slice(0, 10)
      const safeName = pageName.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()
      downloadCsv(`${safeName}_${date}.csv`, csv)
      toast.success(`Exported ${data.records.length} records`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={exportCsv} disabled={loading}>
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      Export CSV
    </Button>
  )
}
