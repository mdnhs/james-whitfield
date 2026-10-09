import "server-only"

import type { BetterAuthPlugin } from "better-auth"
import { createAuthMiddleware, isAPIError } from "better-auth/api"

// Better Auth puts the raw session token in several JSON bodies (sign-in,
// the two-factor verifies, change-password, get-session,
// stop-impersonating…), and the session's IP address and user agent in
// some. The browser needs none of it: the session travels in its HttpOnly
// cookie. So script, XSS included, never sees a token or an IP. Server-side
// `auth.api.*` calls (no request) keep the full body.

type Body = Record<string, unknown>

const isPlainObject = (value: unknown): value is Body =>
  typeof value === "object" &&
  value !== null &&
  Object.getPrototypeOf(value) === Object.prototype

const SESSION_SECRETS = ["token", "ipAddress", "userAgent"] as const

// A copy without the secrets, or null when there was nothing to remove.
export function scrubAuthBody(value: unknown): Body | null {
  if (!isPlainObject(value)) return null
  let changed = false
  const body: Body = { ...value }
  if ("token" in body) {
    delete body.token
    changed = true
  }
  if (isPlainObject(body.session)) {
    const session: Body = { ...body.session }
    for (const key of SESSION_SECRETS) {
      if (key in session) {
        delete session[key]
        changed = true
      }
    }
    body.session = session
  }
  return changed ? body : null
}

// Listed last, so every other plugin's after-hook has seen the full body.
// Only the JSON changes: the cookies Better Auth set are kept.
export const responseScrub = () =>
  ({
    id: "response-scrub",
    hooks: {
      after: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            if (!ctx.request) return
            const returned = ctx.context.returned
            if (isAPIError(returned)) return
            const scrubbed = scrubAuthBody(returned)
            if (scrubbed) return ctx.json(scrubbed)
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin
