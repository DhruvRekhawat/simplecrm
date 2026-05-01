"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function RenameDialog({
  open,
  onOpenChange,
  pageId,
  initialName,
  initialIcon,
  onUpdated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  pageId: string
  initialName: string
  initialIcon: string
  onUpdated: () => void
}) {
  const [name, setName] = useState(initialName)
  const [icon, setIcon] = useState(initialIcon)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initialName)
      setIcon(initialIcon)
    }
  }, [open, initialName, initialIcon])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), icon }),
      })
      if (!res.ok) {
        toast.error("Failed to rename")
        return
      }
      onUpdated()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename page</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="space-y-2">
              <Label htmlFor="rn-icon">Icon</Label>
              <Input
                id="rn-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 4))}
                className="w-16 text-center text-lg"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="rn-name">Name</Label>
              <Input
                id="rn-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
