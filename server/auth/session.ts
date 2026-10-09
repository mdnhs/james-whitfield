import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { toActor, type Actor } from "./actor"
import { getAuth } from "./auth"

// One full (database-checked) session read per request.
export const getSession = cache(async () =>
  getAuth().api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  })
)

export async function requireActor(next = "/admin"): Promise<Actor> {
  const session = await getSession()
  if (!session) redirect(`/admin/sign-in?next=${encodeURIComponent(next)}`)
  return toActor(session)
}
