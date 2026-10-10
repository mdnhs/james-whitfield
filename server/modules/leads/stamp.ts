import "server-only"

import { timingSafeEqual } from "node:crypto"

import { derivedHmac } from "@/server/lib/crypto"

export const STAMP_MIN_MS = 3_000
export const STAMP_MAX_MS = 7 * 86_400_000
const sign = (ms: string) => derivedHmac("lead-stamp", ms).slice(0, 32)

export const issueStamp = (now = Date.now()) => `${now}.${sign(String(now))}`

export function checkStamp(stamp: string | undefined, now = Date.now()) {
  const [ms, mac] = (stamp ?? "").split(".")
  if (!ms || !mac || !/^\d{13}$/.test(ms)) return "stamp" as const
  const expected = Buffer.from(sign(ms))
  const given = Buffer.from(mac)
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return "stamp" as const
  const age = now - Number(ms)
  if (age < 0 || age > STAMP_MAX_MS) return "stamp" as const
  return age < STAMP_MIN_MS ? ("too-fast" as const) : ("ok" as const)
}
