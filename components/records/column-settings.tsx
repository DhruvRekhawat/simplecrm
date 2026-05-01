"use client"

import { useEffect, useState } from "react"
import { Eye, EyeOff, GripVertical } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { SchemaField, FieldType } from "@/lib/schema-detector"

const TYPES: FieldType[] = [
  "string",
  "number",
  "boolean",
  "phone",
  "url",
  "email",
  "array",
  "json",
]

export function ColumnSettings({
  open,
  onOpenChange,
  schema,
  pageId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  schema: SchemaField[]
  pageId: string
  onSaved: (next: SchemaField[]) => void
}) {
  const [fields, setFields] = useState<SchemaField[]>(schema)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setFields(schema)
  }, [open, schema])

  function update(i: number, patch: Partial<SchemaField>) {
    const next = [...fields]
    next[i] = { ...next[i], ...patch }
    setFields(next)
  }

  function move(from: number, to: number) {
    if (from === to) return
    const next = [...fields]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setFields(next)
  }

  function toggleAll(visible: boolean) {
    setFields(fields.map((f) => ({ ...f, visible })))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: fields }),
      })
      if (!res.ok) {
        toast.error("Failed to save")
        return
      }
      onSaved(fields)
      toast.success("Columns updated")
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 overflow-y-auto">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>Columns</SheetTitle>
          <SheetDescription>
            Drag to reorder. Click the eye to hide a column.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-2 flex items-center gap-2 text-xs">
          <button
            onClick={() => toggleAll(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            Show all
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            onClick={() => toggleAll(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            Hide all
          </button>
        </div>

        <div className="px-3 pb-4">
          {fields.map((f, i) => (
            <div
              key={f.key}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                e.preventDefault()
                setOverIndex(i)
              }}
              onDragLeave={() => setOverIndex((cur) => (cur === i ? null : cur))}
              onDrop={(e) => {
                e.preventDefault()
                if (dragIndex !== null) move(dragIndex, i)
                setDragIndex(null)
                setOverIndex(null)
              }}
              onDragEnd={() => {
                setDragIndex(null)
                setOverIndex(null)
              }}
              className={cn(
                "group flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent/30 transition",
                overIndex === i && dragIndex !== null && "bg-accent",
                dragIndex === i && "opacity-50"
              )}
            >
              <button
                className="cursor-grab active:cursor-grabbing text-muted-foreground"
                aria-label="Drag to reorder"
              >
                <GripVertical className="size-4" />
              </button>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => update(i, { visible: !f.visible })}
                aria-label={f.visible ? "Hide" : "Show"}
              >
                {f.visible ? (
                  <Eye className="size-4" />
                ) : (
                  <EyeOff className="size-4 opacity-50" />
                )}
              </button>
              <Input
                value={f.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className="h-8 flex-1"
              />
              <Select
                value={f.type}
                onValueChange={(v) => update(i, { type: v as FieldType })}
              >
                <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <SheetFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
