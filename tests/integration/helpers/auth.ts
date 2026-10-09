import { eq } from "drizzle-orm"

import type { RoleName } from "@/lib/auth/permissions"
import { app } from "@/server/api/app"
import { getAuth } from "@/server/auth/auth"
import { getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"

export const PASSWORD = "correct horse battery staple"
export const ORIGIN = "http://localhost:3000"

export async function createUser(
  role: RoleName,
  email = `${role}@example.com`
) {
  const { user } = await getAuth().api.createUser({
    body: { email, password: PASSWORD, name: role, role },
  })
  return user
}

// Signs in through Better Auth and returns a Cookie header for app.request.
export async function signIn(email: string, password = PASSWORD) {
  const response = await getAuth().api.signInEmail({
    body: { email, password },
    asResponse: true,
  })
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")
}

// Stands in for finishing 2FA setup (the real TOTP flow is covered end to
// end), so owner and admin sessions get past the API's two-factor check.
// Set after sign-in: with the flag on, a password sign-in only opens a
// two-factor challenge and returns no session.
export async function markTwoFactorEnabled(email: string) {
  await getDb()
    .update(users)
    .set({ twoFactorEnabled: true })
    .where(eq(users.email, email))
}

// A signed-in owner or admin who has completed two-factor setup.
export async function signInWithTwoFactor(email: string) {
  const cookie = await signIn(email)
  await markTwoFactorEnabled(email)
  return cookie
}

export function adminRequest(
  path: string,
  cookie: string,
  init: { method?: string; body?: unknown; origin?: string } = {}
) {
  return app.request(`/api/v1/admin${path}`, {
    method: init.method ?? "GET",
    headers: {
      cookie,
      origin: init.origin ?? ORIGIN,
      "content-type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

// A View-as session: `cookie` is a signed-in owner or admin with 2FA.
// Started server-side, as a Phase 10 View-as route will.
export async function viewAs(cookie: string, userId: string) {
  const started = await getAuth().api.impersonateUser({
    body: { userId },
    headers: new Headers({ cookie }),
    asResponse: true,
  })
  if (started.status !== 200) throw new Error(`View-as: ${started.status}`)
  return started.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .filter((pair) => !pair.endsWith("="))
    .join("; ")
}
