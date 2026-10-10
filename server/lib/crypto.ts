import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import { getEnv } from "@/server/env"

// Keyed hash: enough to spot repeated abuse, impossible to reverse into an
// address without the server secret (privacy by design, brief §15).
export function hashIp(ip: string) {
  return createHmac("sha256", getEnv().BETTER_AUTH_SECRET)
    .update(ip)
    .digest("hex")
    .slice(0, 32)
}

// Domain-separated keys from the one server secret (Ruling R2).
export function derivedHmac(label: string, value: string) {
  const key = createHmac("sha256", getEnv().BETTER_AUTH_SECRET)
    .update(label)
    .digest()
  return createHmac("sha256", key).update(value).digest("hex")
}

export const hashEmail = (email: string) =>
  derivedHmac("email", email.trim().toLowerCase()).slice(0, 32)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const unsubscribeMac = (id: string) =>
  derivedHmac("newsletter-unsubscribe", id).slice(0, 32)

// Stateless, so it never expires and nothing is stored: `<id>.<mac>`.
export const unsubscribeToken = (id: string) => `${id}.${unsubscribeMac(id)}`

// Returns the subscriber id for a genuine token, null for anything else.
export function readUnsubscribeToken(token: string): string | null {
  const dot = token.indexOf(".")
  if (dot < 1) return null
  const id = token.slice(0, dot)
  if (!UUID.test(id)) return null
  const given = Buffer.from(token.slice(dot + 1))
  const expected = Buffer.from(unsubscribeMac(id))
  if (given.length !== expected.length) return null
  return timingSafeEqual(given, expected) ? id.toLowerCase() : null
}
