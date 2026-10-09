import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { toActor, type Actor } from "./actor"
import { getFreshSession } from "./fresh-session"

// One full (database-checked) session read per request.
export const getSession = cache(async () => {
  const { session } = await getFreshSession(await headers())
  return session
})

export async function requireActor(next = "/admin"): Promise<Actor> {
  const session = await getSession()
  if (!session) redirect(`/admin/sign-in?next=${encodeURIComponent(next)}`)
  return toActor(session)
}
