import { afterEach, describe, expect, it, vi } from "vitest"

import { getEnv, resetEnvForTests } from "./env"

const CRON = "test-cron-secret-0123456789-abcdefghij"

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

  it("requires RESEND_API_KEY only for the resend driver", () => {
    base()
    vi.stubEnv("EMAIL_DRIVER", "resend")
    vi.stubEnv("RESEND_API_KEY", undefined)
    expect(() => getEnv()).toThrow(/RESEND_API_KEY/)
    vi.stubEnv("RESEND_API_KEY", "re_test_123")
    resetEnvForTests()
    expect(getEnv().EMAIL_DRIVER).toBe("resend")
  })

  it("rejects the log driver in production", () => {
    base()
    vi.stubEnv("SITE_ENV", "production")
    vi.stubEnv("EMAIL_DRIVER", "log")
    expect(() => getEnv()).toThrow(/EMAIL_DRIVER/)
  })
})

describe("getEnv BETTER_AUTH_URL", () => {
  const configure = (siteEnv: string, authUrl: string) => {
    vi.stubEnv("SITE_ENV", siteEnv)
    vi.stubEnv("BETTER_AUTH_URL", authUrl)
    vi.stubEnv("EMAIL_DRIVER", "smtp")
    vi.stubEnv("SMTP_URL", "smtp://localhost:1025")
    vi.stubEnv("CRON_SECRET", CRON)
  }

  it.each(["staging", "production"])("requires https in %s", (siteEnv) => {
    configure(siteEnv, "http://admin.example.ie")
    expect(() => getEnv()).toThrow(/BETTER_AUTH_URL must use https/)
  })

  it("accepts https in production", () => {
    configure("production", "https://admin.example.ie")
    expect(getEnv().BETTER_AUTH_URL).toBe("https://admin.example.ie")
  })

  it("allows http in development", () => {
    configure("development", "http://localhost:3000")
    expect(getEnv().BETTER_AUTH_URL).toBe("http://localhost:3000")
  })
})

describe("getEnv media", () => {
  const configure = (siteEnv: string, publicUrl: string) => {
    vi.stubEnv("SITE_ENV", siteEnv)
    vi.stubEnv("BETTER_AUTH_URL", "https://admin.example.ie")
    vi.stubEnv("EMAIL_DRIVER", "smtp")
    vi.stubEnv("SMTP_URL", "smtp://localhost:1025")
    vi.stubEnv("MEDIA_DRIVER", "s3")
    vi.stubEnv("MEDIA_PUBLIC_URL", publicUrl)
    vi.stubEnv("S3_ACCOUNT_ID", "acct")
    vi.stubEnv("S3_BUCKET", "media")
    vi.stubEnv("S3_ACCESS_KEY_ID", "k")
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "s")
    vi.stubEnv("CRON_SECRET", CRON)
  }

  it.each(["staging", "production"])(
    "requires an https MEDIA_PUBLIC_URL in %s",
    (siteEnv) => {
      configure(siteEnv, "http://media.example.ie")
      expect(() => getEnv()).toThrow(/MEDIA_PUBLIC_URL must use https/)
    }
  )

  it("allows an http emulator in development", () => {
    configure("development", "http://localhost:9000/media")
    expect(getEnv().MEDIA_PUBLIC_URL).toBe("http://localhost:9000/media")
  })

  it("requires the bucket and credentials for the s3 driver", () => {
    configure("production", "https://media.example.ie")
    vi.stubEnv("S3_BUCKET", undefined)
    expect(() => getEnv()).toThrow(/S3_BUCKET is required/)
  })
})

describe("getEnv CRON_SECRET", () => {
  it("requires CRON_SECRET outside development", () => {
    vi.stubEnv("SITE_URL", "https://www.example.ie")
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@db:5432/app")
    vi.stubEnv("SITE_ENV", "staging")
    vi.stubEnv("BETTER_AUTH_URL", "https://x.example")
    vi.stubEnv("CRON_SECRET", undefined)
    expect(() => getEnv()).toThrow(/CRON_SECRET/)
  })
})

describe("getEnv Turnstile", () => {
  it("wants both Turnstile keys or neither", () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "1x00000000000000000000AA")
    vi.stubEnv("TURNSTILE_SECRET_KEY", undefined)
    expect(() => getEnv()).toThrow(/TURNSTILE_SECRET_KEY/)
  })
})

describe("getEnv tracking secrets", () => {
  const base = () => {
    vi.stubEnv("SITE_URL", "https://www.example.ie")
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@db:5432/app")
  }

  it("accepts a 32-byte base64 APP_ENCRYPTION_KEY and rejects anything else", () => {
    base()
    vi.stubEnv("APP_ENCRYPTION_KEY", Buffer.alloc(32, 3).toString("base64"))
    expect(getEnv().APP_ENCRYPTION_KEY).toHaveLength(44)
    resetEnvForTests()
    vi.stubEnv("APP_ENCRYPTION_KEY", Buffer.alloc(16, 3).toString("base64"))
    expect(() => getEnv()).toThrow(/APP_ENCRYPTION_KEY/)
  })

  it("APP_ENCRYPTION_KEY is optional, even in production", () => {
    base()
    vi.stubEnv("APP_ENCRYPTION_KEY", undefined)
    expect(getEnv().APP_ENCRYPTION_KEY).toBeUndefined()
  })

  it("reads DISABLE_CUSTOM_SCRIPTS as a boolean, default false", () => {
    base()
    vi.stubEnv("DISABLE_CUSTOM_SCRIPTS", undefined)
    expect(getEnv().DISABLE_CUSTOM_SCRIPTS).toBe(false)
    resetEnvForTests()
    vi.stubEnv("DISABLE_CUSTOM_SCRIPTS", "true")
    expect(getEnv().DISABLE_CUSTOM_SCRIPTS).toBe(true)
  })
})
