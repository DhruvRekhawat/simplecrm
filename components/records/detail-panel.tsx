"use client"

import { useEffect, useState } from "react"
import { ChevronUp, ChevronDown, Trash2, X as XIcon, MapPin } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FieldRenderer } from "./field-renderers"
import {
  ScoreCell,
  StarredCell,
  StatusCell,
} from "./field-renderers/system-cells"
import type { SchemaField } from "@/lib/schema-detector"
import type { RecordRow } from "@/hooks/use-records"

function relativeTime(iso: string) {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

function findMapsUrl(record: RecordRow, schema: SchemaField[]): string | null {
  for (const f of schema) {
    if (f.type !== "url") continue
    const v = record.data?.[f.key]
    if (typeof v === "string" && /google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl/.test(v)) {
      return v
    }
  }
  return null
}

export function DetailPanel({
  open,
  onOpenChange,
  record,
  schema,
  titleField,
  statusOptions,
  pageId,
  onUpdated,
  onDeleted,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  record: RecordRow | null
  schema: SchemaField[]
  titleField: string
  statusOptions: string[]
  pageId: string
  onUpdated: (id: string, update: Partial<RecordRow>) => void
  onDeleted: (id: string) => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}) {
  const [tagInput, setTagInput] = useState("")
  const [noteInput, setNoteInput] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setTagInput("")
      setNoteInput("")
    }
  }, [open])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable
      if (isTyping) return
      if (e.key === "ArrowUp") {
        e.preventDefault()
        if (hasPrev) onPrev()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        if (hasNext) onNext()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, hasPrev, hasNext, onPrev, onNext])

  if (!record) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" />
      </Sheet>
    )
  }

  const rawTitle = titleField ? record.data?.[titleField] : undefined
  const titleValue: string =
    rawTitle !== undefined && rawTitle !== null && rawTitle !== ""
      ? String(rawTitle)
      : "Record"
  const mapsUrl = findMapsUrl(record, schema)

  async function patch(update: Partial<RecordRow>) {
    onUpdated(record!._id, update)
    const res = await fetch(`/api/pages/${pageId}/records/${record!._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    })
    if (!res.ok) toast.error("Update failed")
  }

  async function addTag(e?: React.KeyboardEvent | React.FormEvent) {
    if (e) e.preventDefault()
    const parts = tagInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const next = Array.from(new Set([...record!.tags, ...parts]))
    setTagInput("")
    await patch({ tags: next })
  }

  async function removeTag(t: string) {
    const next = record!.tags.filter((x) => x !== t)
    await patch({ tags: next })
  }

  async function addNote(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const text = noteInput.trim()
    if (!text) return
    setNoteInput("")
    const optimisticNote = {
      _id: `tmp-${Date.now()}`,
      text,
      createdAt: new Date().toISOString(),
    }
    onUpdated(record!._id, {
      notes: [...record!.notes, optimisticNote],
    })
    const res = await fetch(`/api/pages/${pageId}/records/${record!._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addNote: text }),
    })
    if (!res.ok) {
      toast.error("Failed to add note")
      return
    }
    const data = await res.json()
    if (data?.record?.notes) {
      onUpdated(record!._id, { notes: data.record.notes })
    }
  }

  async function confirmDelete() {
    const res = await fetch(`/api/pages/${pageId}/records/${record!._id}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      toast.error("Delete failed")
      return
    }
    toast.success("Record deleted")
    onDeleted(record!._id)
    setDeleteOpen(false)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onPrev}
                disabled={!hasPrev}
                aria-label="Previous record"
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onNext}
                disabled={!hasNext}
                aria-label="Next record"
              >
                <ChevronDown className="size-4" />
              </Button>
              <span className="text-xs text-muted-foreground ml-1">↑/↓ to navigate</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </Button>
          </div>

          <SheetHeader className="p-0 space-y-0">
            <div className="flex items-center gap-2">
              <StarredCell
                value={record.starred}
                onChange={(v) => patch({ starred: v })}
              />
              <SheetTitle className="truncate">{titleValue}</SheetTitle>
            </div>
            <SheetDescription className="sr-only">Record details</SheetDescription>
            <div className="flex items-center gap-3 mt-3">
              <StatusCell
                value={record.status}
                options={statusOptions}
                onChange={(v) => patch({ status: v })}
              />
              <ScoreCell
                value={record.score}
                onChange={(v) => patch({ score: v })}
              />
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border hover:bg-accent"
                >
                  <MapPin className="size-3" /> View on Maps
                </a>
              )}
            </div>
          </SheetHeader>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Data */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Data
            </h3>
            <div className="space-y-2.5">
              {schema.map((f) => (
                <div key={f.key} className="grid grid-cols-3 gap-2 items-start">
                  <div className="text-xs text-muted-foreground pt-1.5">{f.label}</div>
                  <div className="col-span-2 text-sm">
                    <FieldRenderer
                      type={f.type}
                      value={record.data?.[f.key]}
                      context="detail"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* Tags */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Tags
            </h3>
            <div className="flex flex-wrap gap-1 mb-2">
              {record.tags.length === 0 && (
                <span className="text-xs text-muted-foreground">No tags</span>
              )}
              {record.tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  {t}
                  <button onClick={() => removeTag(t)} aria-label="Remove tag">
                    <XIcon className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <form onSubmit={addTag}>
              <Input
                placeholder="Add tag (comma-separated, Enter to add)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTag(e)
                }}
                className="h-8"
              />
            </form>
          </section>

          <Separator />

          {/* Notes */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Notes
            </h3>
            <form onSubmit={addNote} className="space-y-2 mb-3">
              <Textarea
                placeholder="Add a note..."
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                rows={2}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={!noteInput.trim()}>
                  Add note
                </Button>
              </div>
            </form>
            <div className="space-y-2">
              {record.notes.length === 0 && (
                <p className="text-xs text-muted-foreground">No notes yet.</p>
              )}
              {[...record.notes]
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )
                .map((n) => (
                  <div
                    key={n._id}
                    className="border rounded-md p-2.5 bg-muted/30"
                  >
                    <div className="text-sm whitespace-pre-wrap">{n.text}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {relativeTime(n.createdAt)}
                    </div>
                  </div>
                ))}
            </div>
          </section>

          <Separator />

          <div className="flex justify-end pb-2">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" /> Delete record
            </Button>
          </div>
        </div>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this record?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
