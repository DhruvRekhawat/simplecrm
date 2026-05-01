"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const SUGGESTED = ["📇", "📋", "📊", "📞", "💼", "🛒", "🍽️", "🏨", "🏥", "🎯", "🌟", "🔥"]

export function CreatePageDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("📇")
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), icon }),
      })
      if (!res.ok) {
        toast.error("Failed to create page")
        return
      }
      const data = await res.json()
      toast.success("Page created")
      setName("")
      setIcon("📇")
      onOpenChange(false)
      onCreated(data.page._id)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create page</DialogTitle>
          <DialogDescription>
            Name your dataset and pick an emoji icon.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="page-name">Name</Label>
            <Input
              id="page-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lucknow Spas"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-icon">Icon (emoji)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="page-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 4))}
                className="w-16 text-center text-lg"
                maxLength={4}
              />
              <div className="flex flex-wrap gap-1">
                {SUGGESTED.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setIcon(e)}
                    className="size-8 rounded-md hover:bg-accent text-lg leading-none"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
