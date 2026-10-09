import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { visibleNav } from "@/lib/admin/nav"
import { requireActor } from "@/server/auth/session"

export default function SettingsIndex() {
  return (
    <Suspense>
      <Go />
    </Suspense>
  )
}

// The first settings page this person may open (nav gates each child), so
// settings.read-only content is never drawn for a globals.read-only role.
async function Go(): Promise<never> {
  const actor = await requireActor("/admin/settings")
  const first = visibleNav(actor.roles).find((item) => item.id === "settings")
    ?.children?.[0]
  if (!first) notFound()
  redirect(first.href)
}
