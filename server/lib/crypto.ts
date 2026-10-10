import "server-only"

import { createHmac } from "node:crypto"

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
