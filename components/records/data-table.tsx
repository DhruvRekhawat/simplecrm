"use client"

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { FieldRenderer } from "./field-renderers"
import {
  ScoreCell,
  StatusCell,
  StarredCell,
} from "./field-renderers/system-cells"
import type { SchemaField } from "@/lib/schema-detector"
import type { RecordRow } from "@/hooks/use-records"

export type SortState = { key: string; dir: "asc" | "desc" } | null

export function DataTable({
  schema,
  records,
  statusOptions,
  sort,
  onSortChange,
  selectedIds,
  onSelectionChange,
  onRowClick,
  onUpdate,
}: {
  schema: SchemaField[]
  records: RecordRow[]
  statusOptions: string[]
  sort: SortState
  onSortChange: (s: SortState) => void
  selectedIds: Set<string>
  onSelectionChange: (s: Set<string>) => void
  onRowClick: (r: RecordRow) => void
  onUpdate: (
    id: string,
    update: Partial<Pick<RecordRow, "status" | "score" | "starred">>
  ) => Promise<void>
}) {
  const visible = schema.filter((f) => f.visible)

  function toggleSort(key: string) {
    if (!sort || sort.key !== key) {
      onSortChange({ key, dir: "asc" })
    } else if (sort.dir === "asc") {
      onSortChange({ key, dir: "desc" })
    } else {
      onSortChange(null)
    }
  }

  function toggleAllOnPage(checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) records.forEach((r) => next.add(r._id))
    else records.forEach((r) => next.delete(r._id))
    onSelectionChange(next)
  }

  const allOnPageSelected =
    records.length > 0 && records.every((r) => selectedIds.has(r._id))
  const someOnPageSelected =
    !allOnPageSelected && records.some((r) => selectedIds.has(r._id))

  function SortIcon({ k }: { k: string }) {
    if (!sort || sort.key !== k)
      return <ChevronsUpDown className="size-3 inline ml-1 opacity-40" />
    return sort.dir === "asc" ? (
      <ChevronUp className="size-3 inline ml-1" />
    ) : (
      <ChevronDown className="size-3 inline ml-1" />
    )
  }

  return (
    <div className="border rounded-md overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox
                checked={
                  allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false
                }
                onCheckedChange={(v) => toggleAllOnPage(!!v)}
                aria-label="Select all on page"
              />
            </TableHead>
            {visible.map((f) => (
              <TableHead
                key={f.key}
                className={cn(
                  "cursor-pointer select-none whitespace-nowrap",
                  f.type === "number" && "text-right"
                )}
                onClick={() => toggleSort(f.key)}
              >
                {f.label}
                <SortIcon k={f.key} />
              </TableHead>
            ))}
            <TableHead
              className="cursor-pointer select-none w-8"
              onClick={() => toggleSort("__system__starred")}
            >
              <span className="sr-only">Starred</span>
              <SortIcon k="__system__starred" />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none whitespace-nowrap"
              onClick={() => toggleSort("__system__status")}
            >
              Status
              <SortIcon k="__system__status" />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none whitespace-nowrap"
              onClick={() => toggleSort("__system__score")}
            >
              Score
              <SortIcon k="__system__score" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={visible.length + 4}
                className="h-32 text-center text-sm text-muted-foreground"
              >
                No records match.
              </TableCell>
            </TableRow>
          ) : (
            records.map((r) => (
              <TableRow
                key={r._id}
                onClick={() => onRowClick(r)}
                className={cn(
                  "cursor-pointer",
                  selectedIds.has(r._id) && "bg-accent/40"
                )}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(r._id)}
                    onCheckedChange={(v) => {
                      const next = new Set(selectedIds)
                      if (v) next.add(r._id)
                      else next.delete(r._id)
                      onSelectionChange(next)
                    }}
                    aria-label="Select record"
                  />
                </TableCell>
                {visible.map((f) => (
                  <TableCell
                    key={f.key}
                    className={cn(
                      "max-w-[280px] align-middle",
                      f.type === "number" && "text-right"
                    )}
                  >
                    <FieldRenderer
                      type={f.type}
                      value={r.data?.[f.key]}
                      context="table"
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <StarredCell
                    value={r.starred}
                    onChange={(v) => onUpdate(r._id, { starred: v })}
                  />
                </TableCell>
                <TableCell>
                  <StatusCell
                    value={r.status}
                    options={statusOptions}
                    onChange={(v) => onUpdate(r._id, { status: v })}
                  />
                </TableCell>
                <TableCell>
                  <ScoreCell
                    value={r.score}
                    onChange={(v) => onUpdate(r._id, { score: v })}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
