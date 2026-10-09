import "server-only"

import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api"

import { parseRoles } from "@/lib/auth/permissions"
import { mustSetUpTwoFactor } from "@/lib/auth/two-factor-policy"

import { SELF_SERVICE_PATHS } from "./account-hooks"

// Better Auth hooks key on `ctx.path`, the matched endpoint's declared path,
// so URL variants (trailing slash, case, encoded segments) that Better Auth's
// router still routes cannot slip past them the way they could slip past a
// prefix match in front of the router.

// Better Auth's admin-plugin endpoints (set-role, create-user,
// set-user-password, ban-user, remove-user, impersonate-user…) check only the
// caller's role, never the target: an admin could make themselves owner or
// take over an owner's account (docs/brief.md §7.2). So none of them is
// served over HTTP. User management goes through our Hono routes and
// services, which enforce owner protection and write the audit log, then call
// `auth.api.*` on the server.
//
// Better Auth's router passes the incoming `request` to the endpoint; a
// server-side `auth.api.*` call passes `headers` at most, never a request.
// Ending an impersonation must always work, whoever is being viewed as.
const HTTP_ADMIN_PATHS = new Set(["/admin/stop-impersonating"])

const isAdminPath = (path: string) => path.startsWith("/admin/")

// Better Auth's own device endpoints hand every session's token and IP
// address to the browser, and /list-sessions refuses sessions older than a
// day (freshAge). Devices are managed through /api/v1/admin/account/sessions
// instead (server/modules/account), which shows neither.
const HTTP_SESSION_PATHS = new Set([
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
])

export const beforeHook = createAuthMiddleware(async (ctx) => {
  if (ctx.request && HTTP_SESSION_PATHS.has(ctx.path)) {
    throw new APIError("FORBIDDEN", {
      code: "SESSION_ENDPOINT_DISABLED",
      message: "Manage devices through the admin API",
    })
  }
  if (isAdminPath(ctx.path)) {
    if (ctx.request && !HTTP_ADMIN_PATHS.has(ctx.path)) {
      throw new APIError("FORBIDDEN", {
        code: "ADMIN_ENDPOINT_DISABLED",
        message: "Manage users through the admin API",
      })
    }
    if (HTTP_ADMIN_PATHS.has(ctx.path)) return
  } else if (!SELF_SERVICE_PATHS.has(ctx.path)) {
    return
  }

  // A server-side admin call made as a user still obeys the 2FA rule
  // (docs/brief.md §7.4), and so do the Account page's password and name
  // changes over HTTP, as the Hono /account routes do: an owner or admin
  // without 2FA gets as far as setting it up and no further. Fresh read (role or 2FA could have changed within
  // the cookie cache's five minutes). Cached on ctx, so the endpoint reuses
  // this same session.
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
export const afterHook = createAuthMiddleware(async (ctx) => {
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
