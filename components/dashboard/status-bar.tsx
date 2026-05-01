"use client"

import { statusClass } from "@/components/records/field-renderers/system-cells"
import { cn } from "@/lib/utils"

const COLOR_FOR_STATUS: Record<string, string> = {
  new: "bg-zinc-500",
  contacted: "bg-blue-500",
  interested: "bg-amber-500",
  not_interested: "bg-red-500",
  converted: "bg-green-500",
  junk: "bg-zinc-700",
}

function colorFor(status: string): string {
  return COLOR_FOR_STATUS[status] || "bg-purple-500"
}

export function StatusBar({
  breakdown,
  total,
  className,
  showLegend = true,
}: {
  breakdown: Record<string, number>
  total: number
  className?: string
  showLegend?: boolean
}) {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1])
  if (total === 0)
    return (
      <div className="text-sm text-muted-foreground">No records yet</div>
    )

  return (
    <div className={cn("space-y-2", className)}>
      <div className="h-2 rounded-full overflow-hidden flex bg-muted">
        {entries.map(([status, count]) => (
          <div
            key={status}
            className={cn("h-full", colorFor(status))}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${status}: ${count}`}
          />
        ))}
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {entries.map(([status, count]) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", colorFor(status))} />
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium",
                  statusClass(status)
                )}
              >
                {status}
              </span>
              <span className="text-muted-foreground tabular-nums">{count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
