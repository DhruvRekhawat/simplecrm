"use client"

import { useEffect, useState } from "react"
import { Plus, X, GripVertical } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { statusClass } from "./field-renderers/system-cells"

export function PageSettingsDialog({
  open,
  onOpenChange,
  pageId,
  initialStatuses,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  pageId: string
  initialStatuses: string[]
  onSaved: (next: string[]) => void
}) {
  const [statuses, setStatuses] = useState<string[]>(initialStatuses)
  const [newStatus, setNewStatus] = useState("")
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  useEffect(() => {
    if (open) setStatuses(initialStatuses)
  }, [open, initialStatuses])

  function add() {
    const v = newStatus.trim().toLowerCase().replace(/\s+/g, "_")
    if (!v) return
    if (statuses.includes(v)) {
      toast.error("Status already exists")
      return
    }
    setStatuses([...statuses, v])
    setNewStatus("")
  }

  function remove(i: number) {
    setStatuses(statuses.filter((_, idx) => idx !== i))
  }

  function rename(i: number, value: string) {
    const v = value.trim().toLowerCase().replace(/\s+/g, "_")
    const next = [...statuses]
    next[i] = v
    setStatuses(next)
  }

  function move(from: number, to: number) {
    if (from === to) return
    const next = [...statuses]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setStatuses(next)
  }

  async function save() {
    const cleaned = statuses.map((s) => s.trim()).filter(Boolean)
    if (cleaned.length === 0) {
      toast.error("At least one status required")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusOptions: cleaned }),
      })
      if (!res.ok) {
        toast.error("Failed to save")
        return
      }
      onSaved(cleaned)
      toast.success("Statuses updated")
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Page settings</DialogTitle>
          <DialogDescription>
            Customize this page&apos;s status options. Existing records keep their
            value even if its status is removed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          {statuses.map((s, i) => (
            <div
              key={`${s}-${i}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (dragIndex !== null) move(dragIndex, i)
                setDragIndex(null)
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent/30",
                dragIndex === i && "opacity-50"
              )}
            >
              <button
                className="cursor-grab active:cursor-grabbing text-muted-foreground"
                aria-label="Drag to reorder"
              >
                <GripVertical className="size-4" />
              </button>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-xs shrink-0",
                  statusClass(s)
                )}
              >
                {s}
              </span>
              <Input
                value={s}
                onChange={(e) => rename(i, e.target.value)}
                className="h-8"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => remove(i)}
                aria-label="Remove"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="add_status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
          />
          <Button type="submit" variant="outline">
            <Plus className="size-4" />
            Add
          </Button>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
