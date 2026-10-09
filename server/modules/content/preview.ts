import "server-only"

import { draftMode } from "next/headers"

import { hasPermission } from "@/lib/auth/permissions"
import { toActor } from "@/server/auth/actor"
import { getSession } from "@/server/auth/session"

// Drafts need both: Next's draft-mode cookie (set only by our preview
// endpoint) and a live session that may read pages. The cookie outlives a
// sign-out, so it is never enough on its own. Public requests stop at the
// first check and never touch the session.
export async function isPreviewing(): Promise<boolean> {
  if (!(await draftMode()).isEnabled) return false
  const session = await getSession()
  return (
    session !== null &&
    hasPermission(toActor(session).roles, { page: ["read"] })
  )
}
