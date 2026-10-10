import "server-only"

import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getAuth } from "@/server/auth/auth"
import { isBanned } from "@/server/auth/fresh-session"

import { viewAsRefusal } from "./guard"
import { loadTarget } from "./manage"

// Ruling R7. Our guard first (owners, self, banned), then Better Auth's
// own impersonate / impersonate-admins check, then its cookies go back to the
// browser. The start is audited by databaseHooks.session.create (auth.ts).
export async function startViewAs(actor: Actor, id: string, headers: Headers) {
  const target = await loadTarget(id)
  const why = viewAsRefusal(actor, target)
  if (why) throw new ApiError("FORBIDDEN", why)
  if (isBanned(target))
    throw new ApiError("CONFLICT", "Unban them before viewing as them")
  const response = await getAuth().api.impersonateUser({
    body: { userId: id },
    headers,
    asResponse: true,
  })
  if (response.status === 401 || response.status === 403)
    throw new ApiError("FORBIDDEN", "You can't view as this person")
  if (!response.ok) throw new ApiError("BAD_REQUEST", "View as couldn't start")
  return response.headers.getSetCookie()
}
