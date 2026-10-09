import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { ADMIN_PATH_HEADER } from "@/lib/auth/admin-path"
import { hasPermission, type Permissions } from "@/lib/auth/permissions"
import { safeNext } from "@/lib/auth/safe-next"
import { mustSetUpTwoFactor } from "@/lib/auth/two-factor-policy"

import { toActor, type Actor } from "./actor"
import { getFreshSession } from "./fresh-session"

export const TWO_FACTOR_SETUP_PATH = "/admin/two-factor-setup"

// One full (database-checked) session read per request.
export const getSession = cache(async () => {
  const { session } = await getFreshSession(await headers())
  return session
})

// Signed in, nothing more. Only the two-factor setup screen uses this:
// everywhere else an owner or admin without 2FA must not get through.
// Without an explicit `next`, a signed-out visitor returns to the page they
// asked for (set by proxy.ts, since layouts never see the pathname).
export async function requireSignedIn(next?: string): Promise<Actor> {
  const session = await getSession()
  if (!session) {
    const target = safeNext(next ?? (await headers()).get(ADMIN_PATH_HEADER))
    redirect(`/admin/sign-in?next=${encodeURIComponent(target)}`)
  }
  return toActor(session)
}

// The panel's gate. Enforcing 2FA here, not only in the panel layout, covers
// every page and component that reads the actor, including ones that render
// in parallel with the layout.
export async function requireActor(next?: string): Promise<Actor> {
  const actor = await requireSignedIn(next)
  if (mustSetUpTwoFactor(actor)) redirect(TWO_FACTOR_SETUP_PATH)
  return actor
}

const NO_ACCESS_PATH = "/admin/no-access"

// Page-level gate (docs/brief.md §7.3, layer 2): spares a user a page of
// 403s. The API still authorises every call on its own.
export async function requirePermission(
  permissions: Permissions,
  next?: string
): Promise<Actor> {
  const actor = await requireActor(next)
  if (!hasPermission(actor.roles, permissions)) {
    const from = safeNext(next ?? (await headers()).get(ADMIN_PATH_HEADER))
    redirect(`${NO_ACCESS_PATH}?from=${encodeURIComponent(from)}`)
  }
  return actor
}
