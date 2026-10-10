import { TOTP } from "otpauth"

import { app } from "@/server/api/app"

import { ORIGIN, PASSWORD } from "./auth"

export const authPost = (path: string, cookie: string, body: unknown) =>
  app.request(`/api/auth${path}`, {
    method: "POST",
    headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify(body),
  })

// Later Set-Cookie values replace earlier ones of the same name.
export function mergeCookies(cookie: string, setCookies: string[]) {
  const jar = new Map(
    cookie
      .split("; ")
      .filter(Boolean)
      .map((p) => [p.split("=")[0]!, p] as const)
  )
  for (const header of setCookies) {
    const pair = header.split(";")[0]!
    const name = pair.split("=")[0]!
    if (pair.endsWith("=")) jar.delete(name)
    else jar.set(name, pair)
  }
  return [...jar.values()].join("; ")
}

// Real TOTP enrolment through Better Auth (enrolment rotates the session).
export async function enrolTotp(cookie: string) {
  const enable = await authPost("/two-factor/enable", cookie, {
    password: PASSWORD,
  })
  if (!enable.ok) throw new Error(`enable: ${enable.status}`)
  const { totpURI, backupCodes } = (await enable.json()) as {
    totpURI: string
    backupCodes: string[]
  }
  const secret = new URL(totpURI).searchParams.get("secret") ?? ""
  const totp = new TOTP({ secret, digits: 6, period: 30 })
  const verify = await authPost("/two-factor/verify-totp", cookie, {
    code: totp.generate(),
  })
  if (!verify.ok) throw new Error(`verify: ${verify.status}`)
  return {
    cookie: mergeCookies(cookie, verify.headers.getSetCookie()),
    totp,
    backupCodes,
  }
}
