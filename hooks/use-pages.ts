"use client"

import useSWR from "swr"

export type PageSummary = {
  _id: string
  name: string
  icon: string
  starred: boolean
  recordCount: number
  titleField: string
  dedupField: string
  statusOptions: string[]
  createdAt: string
  updatedAt: string
}

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error("Request failed")
  return r.json()
}

export function usePages() {
  return useSWR<{ pages: PageSummary[] }>("/api/pages", fetcher)
}

export function useStarredPages() {
  return useSWR<{ pages: PageSummary[] }>("/api/pages?starred=1", fetcher)
}
