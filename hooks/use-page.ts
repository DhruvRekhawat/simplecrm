"use client"

import useSWR from "swr"

export type PageDetail = {
  _id: string
  name: string
  icon: string
  starred: boolean
  schema: Array<{
    key: string
    label: string
    type: string
    visible: boolean
    pinned: boolean
  }>
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

export function usePage(pageId: string | undefined) {
  return useSWR<{ page: PageDetail }>(
    pageId ? `/api/pages/${pageId}` : null,
    fetcher
  )
}
