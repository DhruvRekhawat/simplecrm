"use client"

import { useState } from "react"
import { Trash2, Tag, Star } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { cn } from "@/lib/utils"
import { statusClass } from "./field-renderers/system-cells"

export type BulkScope =
  | { type: "ids"; ids: string[] }
  | {
      type: "filters"
      search: string
      filters: unknown
      status: string[]
      scoreMin: number
    }

export function BulkToolbar({
  selectedCount,
  totalMatching,
  scope,
  statusOptions,
  pageId,
  onClear,
  onComplete,
  onSelectAllMatching,
  showSelectAllOffer,
}: {
  selectedCount: number
  totalMatching: number
  scope: BulkScope
  statusOptions: string[]
  pageId: string
  onClear: () => void
  onComplete: () => void
  onSelectAllMatching: () => void
  showSelectAllOffer: boolean
}) {
  const [tagInput, setTagInput] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [running, setRunning] = useState(false)

  async function call(action: string, value?: string | number) {
    setRunning(true)
    try {
      const body: Record<string, unknown> = { action }
      if (value !== undefined) body.value = value
      if (scope.type === "ids") body.ids = scope.ids
      else
        body.scope = {
          search: scope.search,
          filters: scope.filters,
          status: scope.status,
          scoreMin: scope.scoreMin,
        }
      const res = await fetch(`/api/pages/${pageId}/records/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        toast.error("Bulk action failed")
        return
      }
      const data = await res.json()
      const affected = data.modified || data.deleted || 0
      toast.success(
        action === "delete"
          ? `Deleted ${affected} record${affected === 1 ? "" : "s"}`
          : `Updated ${affected} record${affected === 1 ? "" : "s"}`
      )
      onComplete()
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap rounded-md border bg-card p-2 shadow-sm">
        <Badge variant="secondary" className="text-sm">
          {selectedCount} selected
        </Badge>

        {showSelectAllOffer && totalMatching > selectedCount && (
          <Button variant="link" size="sm" onClick={onSelectAllMatching}>
            Select all {totalMatching} matching
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={running}>
                Set status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {statusOptions.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onSelect={() => call("set_status", s)}
                >
                  <span className={cn("px-1.5 py-0.5 rounded text-xs", statusClass(s))}>
                    {s}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={running}>
                <Star className="size-3.5" /> Set score
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <DropdownMenuItem
                  key={n}
                  onSelect={() => call("set_score", n)}
                >
                  {n === 0 ? "Clear" : `${n} star${n === 1 ? "" : "s"}`}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={running}>
                <Tag className="size-3.5" /> Add tag
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const t = tagInput.trim()
                  if (!t) return
                  setTagInput("")
                  call("add_tag", t)
                }}
                className="space-y-2"
              >
                <Input
                  placeholder="Tag name"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  autoFocus
                />
                <Button type="submit" size="sm" className="w-full">
                  Add
                </Button>
              </form>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            disabled={running}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" /> Delete
          </Button>

          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} record{selectedCount === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDeleteOpen(false)
                call("delete")
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
