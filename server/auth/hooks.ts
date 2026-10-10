import "server-only"

import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api"
import { expireCookie } from "better-auth/cookies"

import { audit } from "@/server/lib/audit"

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
  if (ctx.request && isAdminPath(ctx.path) && !HTTP_ADMIN_PATHS.has(ctx.path)) {
    throw new APIError("FORBIDDEN", {
      code: "ADMIN_ENDPOINT_DISABLED",
      message: "Manage users through the admin API",
    })
  }
})

// When enrolment completes, every other session (all of them password-only)
// is revoked, and only the one rotated by enrolment survives: turning 2FA on
// signs out anyone who got in with the password alone.
export const afterHook = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/admin/stop-impersonating") return auditStop(ctx)
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
  await audit(
    {
      userId: fresh.user.id,
      email: fresh.user.email,
      ip: fresh.session.ipAddress ?? null,
      userAgent: fresh.session.userAgent ?? null,
    },
    {
      action: "account.two_factor_enable",
      entityType: "user",
      entityId: fresh.user.id,
      summary: "Turned on two-factor authentication",
    }
  )
})

// stopImpersonating reads the View-as session through getSessionFromCtx,
// which leaves it on ctx.context.session; the endpoint then restores the
// real user's session (ctx.context.newSession).
async function auditStop(
  ctx: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]
) {
  const returned = ctx.context.returned
  if (!returned || isAPIError(returned)) return
  // View-as set dont_remember to hold its session to the hour. The endpoint
  // sets it again only if the real user chose not to be remembered;
  // otherwise it would stop their restored session from ever refreshing.
  const dontRemember = ctx.context.authCookies.dontRememberToken
  const reset = ctx.context.responseHeaders
    ?.getSetCookie()
    .some((cookie) => cookie.startsWith(`${dontRemember.name}=`))
  if (!reset) expireCookie(ctx, dontRemember)
  const viewed = ctx.context.session as {
    user: { id: string; name: string }
    session: {
      impersonatedBy?: string | null
      ipAddress?: string | null
      userAgent?: string | null
    }
  } | null
  const by = viewed?.session.impersonatedBy
  if (!viewed || !by) return
  // The stop has already happened; a failed audit write must not report it
  // as failed.
  try {
    await audit(
      {
        userId: by,
        ip: viewed.session.ipAddress ?? null,
        userAgent: viewed.session.userAgent ?? null,
      },
      {
        action: "auth.stop_impersonate",
        entityType: "user",
        entityId: viewed.user.id,
        summary: `Stopped viewing as ${viewed.user.name}`,
      }
    )
  } catch (error) {
    console.error("stop-impersonating audit failed", error)
  }
}
