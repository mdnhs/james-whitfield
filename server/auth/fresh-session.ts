import "server-only"

import { isAPIError } from "better-auth/api"
import { eq } from "drizzle-orm"

import { getDb } from "@/server/db/client"
import { sessions } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"

import type { SessionLike } from "./actor"
import { getAuth } from "./auth"
import { VIEW_AS_SECONDS } from "./view-as-limit"

export type FreshSession = {
  // null when anonymous, banned or the session could not be verified.
  session: SessionLike | null
  // Set-Cookie values from a session refresh, to forward to the client.
  setCookies: string[]
}

const ANONYMOUS: FreshSession = { session: null, setCookies: [] }

export function isBanned(user: {
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
    if (await viewAsExpired(response)) return ANONYMOUS
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

// Better Auth keeps a View-as session to its hour only while the
// dont_remember cookie is present; without it the rolling refresh extends the
// session to seven days. So the hour is enforced here, from the row's
// createdAt, which no refresh moves.
async function viewAsExpired(found: {
  user: { id: string }
  session: {
    id: string
    createdAt?: Date | string | null
    impersonatedBy?: string | null
    ipAddress?: string | null
    userAgent?: string | null
  }
}) {
  const { session } = found
  if (!session.impersonatedBy || !session.createdAt) return false
  const age = Date.now() - new Date(session.createdAt).getTime()
  if (age <= VIEW_AS_SECONDS * 1000) return false
  const [deleted] = await getDb()
    .delete(sessions)
    .where(eq(sessions.id, session.id))
    .returning({ id: sessions.id })
  // Concurrent requests race to the delete; only the winner audits.
  if (deleted) {
    await audit(
      {
        userId: session.impersonatedBy,
        ip: session.ipAddress ?? null,
        userAgent: session.userAgent ?? null,
      },
      {
        action: "user.view_as_expired",
        entityType: "user",
        entityId: found.user.id,
        summary: "A View-as session ran past its hour and was ended",
      }
    )
  }
  return true
}
