import type { RoleName } from "@/lib/auth/permissions"
import { app } from "@/server/api/app"
import { getAuth } from "@/server/auth/auth"

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
