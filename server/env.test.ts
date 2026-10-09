import { afterEach, describe, expect, it, vi } from "vitest"

import { getEnv, resetEnvForTests } from "./env"

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvForTests()
})

describe("getEnv", () => {
  it("parses the runtime environment and applies defaults", () => {
    vi.stubEnv("SITE_URL", "https://www.example.ie")
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@db:5432/app")
    vi.stubEnv("SITE_ENV", undefined)
    const env = getEnv()
    expect(env.SITE_URL).toBe("https://www.example.ie")
    expect(env.SITE_ENV).toBe("development")
  })

  it("names every invalid variable in one error", () => {
    vi.stubEnv("SITE_URL", "not a url")
    vi.stubEnv("DATABASE_URL", "")
    let message = ""
    try {
      getEnv()
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toMatch(/SITE_URL/)
    expect(message).toMatch(/DATABASE_URL/)
  })
})

describe("getEnv email validation", () => {
  const base = () => {
    vi.stubEnv("SITE_URL", "https://www.example.ie")
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@db:5432/app")
  }

  it("requires SMTP_URL for the smtp driver", () => {
    base()
    vi.stubEnv("EMAIL_DRIVER", "smtp")
    vi.stubEnv("SMTP_URL", undefined)
    expect(() => getEnv()).toThrow(/SMTP_URL/)
  })

  it("rejects the log driver in production", () => {
    base()
    vi.stubEnv("SITE_ENV", "production")
    vi.stubEnv("EMAIL_DRIVER", "log")
    expect(() => getEnv()).toThrow(/EMAIL_DRIVER/)
  })
})
