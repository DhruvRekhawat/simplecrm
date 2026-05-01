"use client"

import { Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const STATUS_COLORS: Record<string, string> = {
  new: "bg-muted text-foreground",
  contacted: "bg-blue-500/15 text-blue-500 border border-blue-500/30",
  interested: "bg-amber-500/15 text-amber-500 border border-amber-500/30",
  not_interested: "bg-red-500/15 text-red-500 border border-red-500/30",
  converted: "bg-green-500/15 text-green-500 border border-green-500/30",
  junk: "bg-zinc-500/15 text-zinc-500 border border-zinc-500/30",
}

export function statusClass(status: string): string {
  return STATUS_COLORS[status] || "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
}

export function StatusCell({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium hover:opacity-80 transition",
            statusClass(value)
          )}
        >
          {value || "—"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onSelect={(e) => {
              e.preventDefault()
              onChange(opt)
            }}
          >
            <Badge variant="outline" className={cn("mr-1", statusClass(opt))}>
              {opt}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ScoreCell({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          onClick={(e) => {
            e.stopPropagation()
            onChange(i === value ? 0 : i)
          }}
          className="p-0.5 hover:scale-110 transition"
          aria-label={`Set score ${i}`}
        >
          <Star
            className={cn(
              "size-3.5",
              i <= value
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  )
}

export function StarredCell({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onChange(!value)
      }}
      className="p-1 rounded hover:bg-accent"
      aria-label={value ? "Unstar" : "Star"}
    >
      <Star
        className={cn(
          "size-4",
          value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/60"
        )}
      />
    </button>
  )
}
