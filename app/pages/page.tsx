"use client"

import { useState } from "react"
import { Plus, Layers } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CreatePageDialog } from "@/components/pages/create-dialog"
import { PageCard } from "@/components/pages/page-card"
import { usePages } from "@/hooks/use-pages"
import { useRouter } from "next/navigation"

export default function PagesPage() {
  const { data, isLoading, mutate } = usePages()
  const [createOpen, setCreateOpen] = useState(false)
  const router = useRouter()
  const pages = data?.pages ?? []

  return (
    <AppShell title="Pages">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading..." : `${pages.length} ${pages.length === 1 ? "page" : "pages"}`}
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Create page
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : pages.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pages.map((p) => (
            <PageCard key={p._id} page={p} onMutate={mutate} />
          ))}
        </div>
      )}

      <CreatePageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          mutate()
          router.push(`/pages/${id}`)
        }}
      />
    </AppShell>
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
        Create a page to start working with a dataset. Each page gets its own schema,
        filters, and statuses.
      </p>
      <Button className="mt-4" onClick={onCreate}>
        <Plus className="size-4" /> Create your first page
      </Button>
    </div>
  )
}
