import "server-only"

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

import { getEnv } from "@/server/env"

// docs/brief.md §12.5 / Ruling R11: v1.<iv>.<tag>.<ciphertext>, base64url,
// AES-256-GCM with a 12-byte IV and the purpose as additional data.
export const CAPI_TOKEN_PURPOSE = "tracking.capiToken"

export class SecretKeyMissingError extends Error {
  constructor() {
    super("APP_ENCRYPTION_KEY is not set")
    this.name = "SecretKeyMissingError"
  }
}

export const secretsAvailable = () => Boolean(getEnv().APP_ENCRYPTION_KEY)

export class SecretKeyInvalidError extends Error {
  constructor() {
    super(
      "APP_ENCRYPTION_KEY must decode to exactly 32 bytes (openssl rand -base64 32)"
    )
    this.name = "SecretKeyInvalidError"
  }
}

// getEnv() already validates the format; this guards AES-256 directly so a
// wrong-length key can never reach createCipheriv with a cryptic error.
function key(): Buffer | null {
  const raw = getEnv().APP_ENCRYPTION_KEY
  if (!raw) return null
  const k = Buffer.from(raw, "base64")
  if (k.length !== 32) throw new SecretKeyInvalidError()
  return k
}

export function encryptSecret(plain: string, purpose: string): string {
  const k = key()
  if (!k) throw new SecretKeyMissingError()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", k, iv)
  cipher.setAAD(Buffer.from(purpose))
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    body.toString("base64url"),
  ].join(".")
}

export function decryptSecret(payload: string, purpose: string): string | null {
  const k = key()
  const [version, iv, tag, body] = payload.split(".")
  if (!k || version !== "v1" || !iv || !tag || !body) return null
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      k,
      Buffer.from(iv, "base64url")
    )
    decipher.setAAD(Buffer.from(purpose))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([
      decipher.update(Buffer.from(body, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    return null
  }
}
