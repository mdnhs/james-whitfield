import "server-only"

import { isAPIError } from "better-auth/api"

import { getAuth } from "./auth"
import type { SessionLike } from "./actor"

export type FreshSession = {
  // null when anonymous, banned or the session could not be verified.
  session: SessionLike | null
  // Set-Cookie values from a session refresh, to forward to the client.
  setCookies: string[]
}

const ANONYMOUS: FreshSession = { session: null, setCookies: [] }

function isBanned(user: {
  banned?: boolean | null
  banExpires?: Date | string | null
}) {
  if (!user.banned) return false
  if (!user.banExpires) return true
  return new Date(user.banExpires).getTime() > Date.now()
}

// Full session check against the database: the 5-minute cookie cache is
// bypassed, and banned users count as anonymous even if Better Auth still
// returns their session.
export async function getFreshSession(headers: Headers): Promise<FreshSession> {
  try {
    const { headers: responseHeaders, response } =
      await getAuth().api.getSession({
        headers,
        query: { disableCookieCache: true },
        returnHeaders: true,
      })
    if (!response || isBanned(response.user)) return ANONYMOUS
    return {
      session: response,
      setCookies: responseHeaders.getSetCookie(),
    }
  } catch (error) {
    // Better Auth's APIError is the expected "session deleted/invalid" case.
    if (isAPIError(error)) return ANONYMOUS
    // Anything else (database outage, bug) must not look like "signed out".
    console.error("getFreshSession failed", error)
    throw error
  }
}
