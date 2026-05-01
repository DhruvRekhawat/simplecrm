"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import { LayoutDashboard, Layers, Star } from "lucide-react"
import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pages", label: "All Pages", icon: Layers },
]

type SidebarPage = {
  _id: string
  name: string
  icon?: string | null
  starred?: boolean
}

const fetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : { pages: [] }))

export function AppSidebar() {
  const pathname = usePathname()
  const { data } = useSWR<{ pages: SidebarPage[] }>("/api/pages", fetcher)
  const all = data?.pages ?? []
  const starred = all.filter((p) => p.starred)
  const others = all.filter((p) => !p.starred)

  return (
    <UISidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1 font-semibold tracking-tight">
          <span className="text-lg">📇</span>
          <span className="group-data-[collapsible=icon]:hidden">SimpleCRM</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/pages" && pathname.startsWith(item.href + "/"))
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {starred.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Starred</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {starred.map((p) => (
                  <PageItem key={p._id} page={p} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {others.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Pages</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {others.map((p) => (
                  <PageItem key={p._id} page={p} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarRail />
    </UISidebar>
  )
}

function PageItem({
  page,
  pathname,
}: {
  page: SidebarPage
  pathname: string
}) {
  const href = `/pages/${page._id}`
  const active = pathname === href
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={page.name}>
        <Link href={href}>
          <span className="text-base leading-none">
            {page.icon || <Star className="size-4" />}
          </span>
          <span className="truncate">{page.name}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
