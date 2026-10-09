import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { ADMIN_PATH_HEADER } from "@/lib/auth/admin-path"
import { safeNext } from "@/lib/auth/safe-next"

import { toActor, type Actor } from "./actor"
import { getFreshSession } from "./fresh-session"

// One full (database-checked) session read per request.
export const getSession = cache(async () => {
  const { session } = await getFreshSession(await headers())
  return session
})

// Without an explicit `next`, a signed-out visitor returns to the page they
// asked for (set by proxy.ts, since layouts never see the pathname).
export async function requireActor(next?: string): Promise<Actor> {
  const session = await getSession()
  if (!session) {
    const target = safeNext(next ?? (await headers()).get(ADMIN_PATH_HEADER))
    redirect(`/admin/sign-in?next=${encodeURIComponent(target)}`)
  }
  return toActor(session)
}
