"use client"

import useSWR from "swr"
import type { FilterMap } from "@/lib/filter-builder"

export type RecordRow = {
  _id: string
  pageId: string
  data: Record<string, unknown>
  status: string
  score: number
  starred: boolean
  tags: string[]
  notes: { _id: string; text: string; createdAt: string }[]
  createdAt: string
  updatedAt: string
}

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error("Request failed")
  return r.json()
}

export type RecordsQuery = {
  search: string
  page: number
  limit: number
  sort: string
  sortDir: "asc" | "desc"
  filters: FilterMap
  status: string[]
  scoreMin: number
}

export function buildRecordsUrl(pageId: string, q: RecordsQuery) {
  const sp = new URLSearchParams()
  if (q.search) sp.set("search", q.search)
  sp.set("page", String(q.page))
  sp.set("limit", String(q.limit))
  if (q.sort) {
    sp.set("sort", q.sort)
    sp.set("sortDir", q.sortDir)
  }
  if (Object.keys(q.filters).length > 0) {
    sp.set("filters", JSON.stringify(q.filters))
  }
  for (const s of q.status) sp.append("status", s)
  if (q.scoreMin > 0) sp.set("scoreMin", String(q.scoreMin))
  return `/api/pages/${pageId}/records?${sp.toString()}`
}

export function useRecords(pageId: string | undefined, q: RecordsQuery) {
  const url = pageId ? buildRecordsUrl(pageId, q) : null
  return useSWR<{
    records: RecordRow[]
    total: number
    page: number
    limit: number
    totalPages: number
  }>(url, fetcher, { keepPreviousData: true })
}

export function useFilters(pageId: string | undefined) {
  return useSWR<{
    filters: Record<string, { distinct?: string[]; min?: number; max?: number }>
  }>(pageId ? `/api/pages/${pageId}/filters` : null, fetcher)
}
