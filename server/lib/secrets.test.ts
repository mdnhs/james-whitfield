import { afterEach, describe, expect, it, vi } from "vitest"

import { resetEnvForTests } from "@/server/env"

import {
  decryptSecret,
  encryptSecret,
  SecretKeyMissingError,
  secretsAvailable,
} from "./secrets"

const KEY_A = Buffer.alloc(32, 1).toString("base64")
const KEY_B = Buffer.alloc(32, 2).toString("base64")
const use = (key: string | undefined) => {
  if (key) process.env.APP_ENCRYPTION_KEY = key
  else delete process.env.APP_ENCRYPTION_KEY
  resetEnvForTests()
}
afterEach(() => use(Buffer.alloc(32, 7).toString("base64")))

describe("secrets (AES-256-GCM, Ruling R11)", () => {
  it("round-trips and never contains the plaintext", () => {
    use(KEY_A)
    const sealed = encryptSecret("EAAB-secret-token", "tracking.capiToken")
    expect(sealed).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/)
    expect(sealed).not.toContain("secret")
    expect(decryptSecret(sealed, "tracking.capiToken")).toBe(
      "EAAB-secret-token"
    )
  })
  it("uses a fresh IV every time", () => {
    use(KEY_A)
    expect(encryptSecret("x", "p")).not.toBe(encryptSecret("x", "p"))
  })
  it("returns null for a wrong key, a wrong purpose or tampering", () => {
    use(KEY_A)
    const sealed = encryptSecret("token", "tracking.capiToken")
    expect(decryptSecret(sealed, "other")).toBeNull()
    const parts = sealed.split(".")
    parts[3] = parts[3]!.slice(0, -2) + (parts[3]!.endsWith("A") ? "BB" : "AA")
    expect(decryptSecret(parts.join("."), "tracking.capiToken")).toBeNull()
    expect(decryptSecret("garbage", "tracking.capiToken")).toBeNull()
    use(KEY_B)
    expect(decryptSecret(sealed, "tracking.capiToken")).toBeNull()
  })
  it("refuses to encrypt without a key, and says so", () => {
    use(undefined)
    expect(secretsAvailable()).toBe(false)
    expect(() => encryptSecret("x", "p")).toThrow(SecretKeyMissingError)
    expect(decryptSecret("v1.a.b.c", "p")).toBeNull()
  })
})

describe("secrets key length", () => {
  afterEach(() => {
    vi.doUnmock("@/server/env")
    vi.resetModules()
  })
  it("throws a clear error when the key is not exactly 32 bytes", async () => {
    vi.resetModules()
    vi.doMock("@/server/env", () => ({
      getEnv: () => ({
        APP_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString("base64"),
      }),
    }))
    const secrets = await import("./secrets")
    expect(() => secrets.encryptSecret("x", "p")).toThrow(
      secrets.SecretKeyInvalidError
    )
    expect(() => secrets.encryptSecret("x", "p")).toThrow(
      "APP_ENCRYPTION_KEY must decode to exactly 32 bytes"
    )
    expect(() => secrets.decryptSecret("v1.a.b.c", "p")).toThrow(
      secrets.SecretKeyInvalidError
    )
  })
})
