import { io } from "next/cache"

import { Toaster } from "@/components/ui/sonner"
import { adminThemeCss } from "@/lib/theme/css"
import { getThemeConfig } from "@/server/modules/content/queries"

import { DefaultMode } from "./default-mode"

// docs/brief.md §10.2 (Ruling R11): the published admin theme, server-side,
// so there is no flash. io() suspends at prerender, so the build never
// reaches the database. The Appearance page previews drafts client-side.
export async function AdminFrame({ children }: { children: React.ReactNode }) {
  await io()
  const { admin } = await getThemeConfig()
  const css = adminThemeCss(admin)
  return (
    <>
      <DefaultMode mode={admin.mode} />
      {css ? <style id="theme-tokens">{css}</style> : null}
      {children}
      <Toaster position="top-center" />
    </>
  )
}
