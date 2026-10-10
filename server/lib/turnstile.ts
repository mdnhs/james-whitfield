import "server-only"

import { getEnv } from "@/server/env"

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const TIMEOUT_MS = 3_000

export const turnstileEnabled = () => Boolean(getEnv().TURNSTILE_SECRET_KEY)
export const turnstileSiteKey = () => getEnv().TURNSTILE_SITE_KEY ?? null

// "fail" is Cloudflare's explicit no (or a token that was never sent);
// "unavailable" means siteverify could not answer. Ruling R17: the caller
// accepts an unavailable check as a flagged lead rather than losing it.
export type TurnstileResult = "pass" | "fail" | "unavailable"

type Siteverify = {
  success?: boolean
  action?: string
  hostname?: string
  "error-codes"?: string[]
}

// docs/brief.md §13: success, action and hostname are all checked; tokens are
// single-use (Cloudflare enforces it).
export async function verifyTurnstile(
  token: string | undefined,
  ip: string | null
): Promise<TurnstileResult> {
  const env = getEnv()
  if (!token || !env.TURNSTILE_SECRET_KEY) return "fail"
  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  })
  if (ip) body.set("remoteip", ip)
  let data: Siteverify
  try {
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`siteverify answered ${res.status}`)
    data = (await res.json()) as Siteverify
  } catch (error) {
    console.error("[turnstile] siteverify unavailable", error)
    return "unavailable"
  }
  if (data["error-codes"]?.includes("internal-error")) {
    console.error("[turnstile] siteverify reported an internal error")
    return "unavailable"
  }
  return data.success === true &&
    data.action === "lead" &&
    data.hostname === new URL(env.SITE_URL).hostname
    ? "pass"
    : "fail"
}
