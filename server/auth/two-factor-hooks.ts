import "server-only"

import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api"

import { parseRoles } from "@/lib/auth/permissions"
import { mustSetUpTwoFactor } from "@/lib/auth/two-factor-policy"

// Better Auth's own admin-plugin endpoints (/api/auth/admin/*: set-role,
// impersonate-user, ban-user…) never pass through the Hono admin routes, so
// the 2FA rule (docs/brief.md §7.4) is enforced here too.
//
// A Better Auth hook rather than Hono middleware on "/auth/admin/*":
// `ctx.path` is the matched endpoint's declared path, so URL variants
// (trailing slash, case, encoded segments) that Better Auth's router still
// routes cannot slip past a prefix match the way they could in front of it.
// Ending an impersonation must always work, whoever is being viewed as.
const OPEN_ADMIN_PATHS = new Set(["/admin/stop-impersonating"])

export const twoFactorBeforeHook = createAuthMiddleware(async (ctx) => {
  if (!ctx.path.startsWith("/admin/") || OPEN_ADMIN_PATHS.has(ctx.path)) return
  // Fresh read (role or 2FA could have changed within the cookie cache's
  // five minutes). Cached on ctx, so the endpoint reuses this same session.
  const session = await getSessionFromCtx(ctx, { disableCookieCache: true })
  // No session: the endpoint refuses (or allows a server-side call) itself.
  if (!session) return
  const actor = {
    roles: parseRoles(session.user.role as string | null | undefined),
    twoFactorEnabled: Boolean(session.user.twoFactorEnabled),
  }
  if (mustSetUpTwoFactor(actor)) {
    throw new APIError("FORBIDDEN", {
      code: "TWO_FACTOR_REQUIRED",
      message: "Set up two-factor authentication to continue",
    })
  }
})

// The 2FA rule reads the user's flag, not how a given session signed in. So
// when enrolment completes, every other session (all of them password-only)
// is revoked, and only the one rotated by enrolment survives.
export const twoFactorAfterHook = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/two-factor/verify-totp") return
  // Enrolment runs with a signed-in session and replaces it with a new one.
  // The sign-in challenge has no prior session; a repeat verify on a session
  // that already has 2FA creates no new one.
  const prior = ctx.context.session
  const fresh = ctx.context.newSession
  if (!prior || !fresh || fresh.session.token === prior.session.token) return
  if (!fresh.user.twoFactorEnabled) return
  const { internalAdapter } = ctx.context
  const others = (await internalAdapter.listSessions(fresh.user.id))
    .map((session) => session.token)
    .filter((token) => token !== fresh.session.token)
  if (others.length) await internalAdapter.deleteSessions(others)
})
