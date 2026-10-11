// admin/modules/ai/route-context.ts
"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, usePathname } from "next/navigation"
import { useMemo } from "react"

import { articleDetailQuery } from "@/admin/modules/insights/queries"
import { pageDetailQuery } from "@/admin/modules/pages/queries"
import type { ChatContext } from "@/lib/ai/schema"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type AssistantScreen = "page" | "article" | "leads" | "default"
export type RouteContext = { screen: AssistantScreen; context: ChatContext }

// From the route alone (no DOM): which screen the person is on and, on an
// editor, the id of what they are editing. Only this ever leaves the browser.
export function contextFromRoute(
  pathname: string,
  params: Record<string, string | string[] | undefined> = {}
): RouteContext | null {
  if (!/^\/admin(\/|$)/.test(pathname)) return null
  const path = pathname.slice(0, 200)
  const editor = /^\/admin\/(pages|insights)\/([^/]+)\/?$/.exec(pathname)
  // The route's own `[id]` param when the router has it, else the segment.
  const id = typeof params.id === "string" ? params.id : editor?.[2]
  if (editor && id === editor[2] && UUID.test(id)) {
    const type = editor[1] === "pages" ? "page" : "article"
    return { screen: type, context: { path, entity: { type, id } } }
  }
  if (/^\/admin\/leads\/?$/.test(pathname))
    return { screen: "leads", context: { path } }
  return { screen: "default", context: { path } }
}

export function useRouteContext(): RouteContext | null {
  const pathname = usePathname()
  const params = useParams()
  const id = typeof params?.id === "string" ? params.id : undefined
  return useMemo(
    () => contextFromRoute(pathname ?? "", id ? { id } : {}),
    [pathname, id]
  )
}

// The name shown on the "Using:" chip. Read from the editor's own cache entry
// (enabled: false, so this never fetches); a generic name until it's there.
export function useContextTitle(route: RouteContext | null): string | null {
  const entity = route?.context.entity
  const page = useQuery({
    ...pageDetailQuery(entity?.type === "page" ? entity.id : ""),
    enabled: false,
  })
  const article = useQuery({
    ...articleDetailQuery(entity?.type === "article" ? entity.id : ""),
    enabled: false,
  })
  if (!entity) return null
  if (entity.type === "page") {
    const title = page.data?.title?.trim()
    return title ? `${title} page` : "This page"
  }
  const title = article.data?.draft.title?.trim()
  return title ? `“${title}”` : "This article"
}
