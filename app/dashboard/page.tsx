"use client"

import Link from "next/link"
import { useState } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { Star, Layers, Plus } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { StatusBar } from "@/components/dashboard/status-bar"
import { CreatePageDialog } from "@/components/pages/create-dialog"
import { cn } from "@/lib/utils"
import { mutate as globalMutate } from "swr"
import { toast } from "sonner"

type DashboardData = {
  totals: {
    pages: number
    records: number
    contactedPct: number
    convertedPct: number
  }
  statusBreakdown: Record<string, number>
  pages: Array<{
    _id: string
    name: string
    icon: string
    starred: boolean
    recordCount: number
    statusBreakdown: { _id: string; count: number }[]
    updatedAt: string
  }>
}

const fetcher = (u: string) => fetch(u).then((r) => r.json())

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
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

export default function DashboardPage() {
  const router = useRouter()
  const { data, isLoading, mutate } = useSWR<DashboardData>("/api/dashboard", fetcher)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <AppShell title="Dashboard">
      <div className="flex justify-end mb-4">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Create page
        </Button>
      </div>
      {isLoading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : data.totals.pages === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total records" value={data.totals.records.toLocaleString()} />
            <StatCard label="Pages" value={data.totals.pages.toString()} />
            <StatCard label="% contacted" value={`${data.totals.contactedPct}%`} />
            <StatCard label="% converted" value={`${data.totals.convertedPct}%`} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Status distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusBar breakdown={data.statusBreakdown} total={data.totals.records} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pages</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.pages.map((p) => {
                  const breakdown: Record<string, number> = {}
                  for (const s of p.statusBreakdown) {
                    breakdown[s._id || "unset"] = s.count
                  }
                  return (
                    <div
                      key={p._id}
                      className="px-4 py-3 flex items-center gap-4 hover:bg-accent/30"
                    >
                      <span className="text-xl">{p.icon || "📋"}</span>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/pages/${p._id}`}
                          className="font-medium hover:underline truncate block"
                        >
                          {p.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {p.recordCount} records · updated {relativeTime(p.updatedAt)}
                        </div>
                      </div>
                      <div className="hidden sm:block w-48">
                        <StatusBar
                          breakdown={breakdown}
                          total={p.recordCount}
                          showLegend={false}
                        />
                      </div>
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/pages/${p._id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ starred: !p.starred }),
                          })
                          if (!res.ok) {
                            toast.error("Failed to update")
                            return
                          }
                          mutate()
                          globalMutate("/api/pages")
                          globalMutate("/api/pages?starred=1")
                        }}
                        className="p-1 rounded hover:bg-accent"
                        aria-label={p.starred ? "Unstar" : "Star"}
                      >
                        <Star
                          className={cn(
                            "size-4",
                            p.starred
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/60"
                          )}
                        />
                      </button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <CreatePageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          mutate()
          globalMutate("/api/pages")
          router.push(`/pages/${id}`)
        }}
      />
    </AppShell>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-lg">
      <div className="size-12 rounded-full bg-accent flex items-center justify-center mb-4">
        <Layers className="size-6 text-muted-foreground" />
      </div>
      <h2 className="font-medium">No pages yet</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Create your first page to start collecting records.
      </p>
      <Button className="mt-4" onClick={onCreate}>
        <Plus className="size-4" /> Create your first page
      </Button>
    </div>
  )
}
