"use client"

import { use, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Star, Upload, ArrowLeft, Settings2, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"
import { mutate as globalMutate } from "swr"
import Link from "next/link"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { usePage } from "@/hooks/use-page"
import { useDebounce } from "@/hooks/use-debounce"
import { useRecords, useFilters, type RecordRow } from "@/hooks/use-records"
import { ImportModal } from "@/components/records/import-modal"
import { FilterBar } from "@/components/records/filter-bar"
import { DataTable, type SortState } from "@/components/records/data-table"
import { PaginationBar } from "@/components/records/pagination"
import { DetailPanel } from "@/components/records/detail-panel"
import { BulkToolbar, type BulkScope } from "@/components/records/bulk-toolbar"
import { ColumnSettings } from "@/components/records/column-settings"
import { ExportButton } from "@/components/records/export-button"
import { PageSettingsDialog } from "@/components/records/page-settings"
import type { FilterMap } from "@/lib/filter-builder"
import type { SchemaField } from "@/lib/schema-detector"

export default function PageView({
  params,
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = use(params)
  const router = useRouter()
  const { data, isLoading, error, mutate: mutatePage } = usePage(pageId)
  const page = data?.page

  useEffect(() => {
    if (error) {
      toast.error("Page not found")
      router.push("/pages")
    }
  }, [error, router])

  return (
    <AppShell title={page?.name ?? "Page"}>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/pages">
            <ArrowLeft className="size-4" /> All pages
          </Link>
        </Button>
      </div>

      {isLoading || !page ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <PageHeader page={page} onMutate={mutatePage} />
          <RecordsSection page={page} />
        </>
      )}
    </AppShell>
  )
}

function ImportButton({
  pageId,
  hasExistingRecords,
  onComplete,
}: {
  pageId: string
  hasExistingRecords: boolean
  onComplete: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload className="size-4" /> Import JSON
      </Button>
      <ImportModal
        open={open}
        onOpenChange={setOpen}
        pageId={pageId}
        hasExistingRecords={hasExistingRecords}
        onComplete={onComplete}
      />
    </>
  )
}

function PageHeader({
  page,
  onMutate,
}: {
  page: NonNullable<ReturnType<typeof usePage>["data"]>["page"]
  onMutate: () => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(page.name)
  const [icon, setIcon] = useState(page.icon)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingName) inputRef.current?.focus()
  }, [editingName])

  async function patch(updates: Partial<{ name: string; icon: string; starred: boolean }>) {
    const res = await fetch(`/api/pages/${page._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      toast.error("Failed to update")
      return false
    }
    onMutate()
    globalMutate("/api/pages")
    globalMutate("/api/pages?starred=1")
    return true
  }

  async function commitName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === page.name) {
      setName(page.name)
      setEditingName(false)
      return
    }
    const ok = await patch({ name: trimmed })
    if (!ok) setName(page.name)
    setEditingName(false)
  }

  async function commitIcon(next: string) {
    const v = next.slice(0, 4)
    setIcon(v)
    if (v !== page.icon) await patch({ icon: v })
  }

  return (
    <div className="flex items-start justify-between gap-3 mb-6">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <input
          aria-label="Page icon"
          value={icon}
          onChange={(e) => commitIcon(e.target.value)}
          className="text-3xl bg-transparent w-12 text-center outline-none rounded-md hover:bg-accent focus:bg-accent"
        />
        {editingName ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName()
              if (e.key === "Escape") {
                setName(page.name)
                setEditingName(false)
              }
            }}
            className="text-2xl font-semibold bg-transparent outline-none border-b border-border flex-1 min-w-0"
          />
        ) : (
          <h1
            className="text-2xl font-semibold truncate cursor-text rounded px-1 -mx-1 hover:bg-accent/50"
            onClick={() => setEditingName(true)}
          >
            {page.name}
          </h1>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => patch({ starred: !page.starred })}
          aria-label={page.starred ? "Unstar" : "Star"}
        >
          <Star
            className={cn(
              "size-5",
              page.starred && "fill-yellow-400 text-yellow-400"
            )}
          />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {(page.schema?.length ?? 0) > 0 && (
          <>
            <PageSettingsButton page={page} onSaved={onMutate} />
            <ColumnSettingsButton page={page} onSaved={onMutate} />
          </>
        )}
        <ImportButton
          pageId={page._id}
          hasExistingRecords={(page.schema?.length ?? 0) > 0}
          onComplete={onMutate}
        />
      </div>
    </div>
  )
}

function ColumnSettingsButton({
  page,
  onSaved,
}: {
  page: NonNullable<ReturnType<typeof usePage>["data"]>["page"]
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="icon" onClick={() => setOpen(true)} aria-label="Column settings">
        <Settings2 className="size-4" />
      </Button>
      <ColumnSettings
        open={open}
        onOpenChange={setOpen}
        schema={page.schema as SchemaField[]}
        pageId={page._id}
        onSaved={() => {
          onSaved()
          globalMutate(`/api/pages/${page._id}/filters`)
        }}
      />
    </>
  )
}

function PageSettingsButton({
  page,
  onSaved,
}: {
  page: NonNullable<ReturnType<typeof usePage>["data"]>["page"]
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="icon" onClick={() => setOpen(true)} aria-label="Page settings">
        <SlidersHorizontal className="size-4" />
      </Button>
      <PageSettingsDialog
        open={open}
        onOpenChange={setOpen}
        pageId={page._id}
        initialStatuses={page.statusOptions}
        onSaved={() => onSaved()}
      />
    </>
  )
}

function RecordsSection({
  page,
}: {
  page: NonNullable<ReturnType<typeof usePage>["data"]>["page"]
}) {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)
  const [filters, setFilters] = useState<FilterMap>({})
  const debouncedFilters = useDebounce(filters, 300)
  const [status, setStatus] = useState<string[]>([])
  const [scoreMin, setScoreMin] = useState(0)
  const [sort, setSort] = useState<SortState>(null)
  const [pageNum, setPageNum] = useState(1)
  const [limit, setLimit] = useState(50)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null)
  const [bulkSelectAllMatching, setBulkSelectAllMatching] = useState(false)

  const query = useMemo(
    () => ({
      search: debouncedSearch,
      page: pageNum,
      limit,
      sort: sort?.key ?? "",
      sortDir: (sort?.dir ?? "asc") as "asc" | "desc",
      filters: debouncedFilters,
      status,
      scoreMin,
    }),
    [debouncedSearch, pageNum, limit, sort, debouncedFilters, status, scoreMin]
  )

  // Reset to page 1 on filter changes
  useEffect(() => {
    setPageNum(1)
  }, [debouncedSearch, debouncedFilters, status, scoreMin, limit])

  const { data: filtersData } = useFilters(page._id)
  const { data: recordsData, isLoading, mutate } = useRecords(page._id, query)

  const schema = (page.schema as SchemaField[]) ?? []
  const records = recordsData?.records ?? []

  async function updateRecord(
    id: string,
    update: Partial<{ status: string; score: number; starred: boolean }>
  ) {
    const prev = records.find((r) => r._id === id)
    // Optimistic update
    mutate(
      (cur) =>
        cur && {
          ...cur,
          records: cur.records.map((r) => (r._id === id ? { ...r, ...update } : r)),
        },
      { revalidate: false }
    )
    const res = await fetch(`/api/pages/${page._id}/records/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    })
    if (!res.ok) {
      toast.error("Update failed")
      // Rollback
      if (prev) {
        mutate(
          (cur) =>
            cur && {
              ...cur,
              records: cur.records.map((r) => (r._id === id ? prev : r)),
            },
          { revalidate: false }
        )
      }
    }
  }

  function patchLocal(id: string, update: Partial<RecordRow>) {
    mutate(
      (cur) =>
        cur && {
          ...cur,
          records: cur.records.map((r) => (r._id === id ? { ...r, ...update } : r)),
        },
      { revalidate: false }
    )
  }

  function deleteLocal(id: string) {
    mutate(
      (cur) =>
        cur && {
          ...cur,
          records: cur.records.filter((r) => r._id !== id),
          total: Math.max(0, cur.total - 1),
        },
      { revalidate: false }
    )
    setSelectedIds((s) => {
      const next = new Set(s)
      next.delete(id)
      return next
    })
    if (activeRecordId === id) setActiveRecordId(null)
  }

  const activeRecordIndex = activeRecordId
    ? records.findIndex((r) => r._id === activeRecordId)
    : -1
  const activeRecord = activeRecordIndex >= 0 ? records[activeRecordIndex] : null

  const allOnPageSelected =
    records.length > 0 && records.every((r) => selectedIds.has(r._id))

  const noRecords = !isLoading && records.length === 0 && Object.keys(filters).length === 0 && status.length === 0 && scoreMin === 0 && !debouncedSearch

  if (schema.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-lg">
        <h2 className="font-medium">No data yet</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Click <strong>Import JSON</strong> above to add data. Schema is auto-detected.
        </p>
      </div>
    )
  }

  if (noRecords) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-lg">
        <h2 className="font-medium">No records yet</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Import a JSON file to populate this page.
        </p>
      </div>
    )
  }

  const bulkScope: BulkScope = bulkSelectAllMatching
    ? {
        type: "filters",
        search: debouncedSearch,
        filters: debouncedFilters,
        status,
        scoreMin,
      }
    : { type: "ids", ids: Array.from(selectedIds) }

  const effectiveSelectedCount = bulkSelectAllMatching
    ? recordsData?.total ?? selectedIds.size
    : selectedIds.size

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <FilterBar
            schema={schema}
            filtersData={filtersData?.filters ?? {}}
            search={search}
            onSearchChange={setSearch}
            filters={filters}
            onFiltersChange={setFilters}
            status={status}
            onStatusChange={setStatus}
            scoreMin={scoreMin}
            onScoreMinChange={setScoreMin}
            statusOptions={page.statusOptions}
          />
        </div>
        <ExportButton
          pageId={page._id}
          pageName={page.name}
          schema={schema}
          query={{
            search: debouncedSearch,
            sort: sort?.key ?? "",
            sortDir: (sort?.dir ?? "asc") as "asc" | "desc",
            filters: debouncedFilters,
            status,
            scoreMin,
          }}
        />
      </div>

      {effectiveSelectedCount > 0 && (
        <BulkToolbar
          selectedCount={effectiveSelectedCount}
          totalMatching={recordsData?.total ?? 0}
          scope={bulkScope}
          statusOptions={page.statusOptions}
          pageId={page._id}
          showSelectAllOffer={
            !bulkSelectAllMatching &&
            allOnPageSelected &&
            (recordsData?.total ?? 0) > selectedIds.size
          }
          onSelectAllMatching={() => setBulkSelectAllMatching(true)}
          onClear={() => {
            setSelectedIds(new Set())
            setBulkSelectAllMatching(false)
          }}
          onComplete={() => {
            setSelectedIds(new Set())
            setBulkSelectAllMatching(false)
            mutate()
          }}
        />
      )}

      {isLoading && !recordsData ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <DataTable
          schema={schema}
          records={records}
          statusOptions={page.statusOptions}
          sort={sort}
          onSortChange={setSort}
          selectedIds={selectedIds}
          onSelectionChange={(s) => {
            setSelectedIds(s)
            setBulkSelectAllMatching(false)
          }}
          onRowClick={(r: RecordRow) => setActiveRecordId(r._id)}
          onUpdate={updateRecord}
        />
      )}

      <PaginationBar
        page={recordsData?.page ?? 1}
        totalPages={recordsData?.totalPages ?? 1}
        total={recordsData?.total ?? 0}
        limit={limit}
        onPageChange={setPageNum}
        onLimitChange={setLimit}
      />

      <DetailPanel
        open={activeRecord !== null}
        onOpenChange={(v) => !v && setActiveRecordId(null)}
        record={activeRecord}
        schema={schema}
        titleField={page.titleField}
        statusOptions={page.statusOptions}
        pageId={page._id}
        onUpdated={patchLocal}
        onDeleted={deleteLocal}
        hasPrev={activeRecordIndex > 0}
        hasNext={activeRecordIndex >= 0 && activeRecordIndex < records.length - 1}
        onPrev={() => {
          if (activeRecordIndex > 0)
            setActiveRecordId(records[activeRecordIndex - 1]._id)
        }}
        onNext={() => {
          if (activeRecordIndex >= 0 && activeRecordIndex < records.length - 1)
            setActiveRecordId(records[activeRecordIndex + 1]._id)
        }}
      />
    </div>
  )
}
