import "server-only"

import * as z from "zod"

// Validated lazily on first use, never at module scope: `next build` runs
// without production secrets or a database (docs/brief.md §5.6).
const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    SITE_ENV: z
      .enum(["development", "staging", "production"])
      .default("development"),
    SITE_URL: z.url(),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    // "resend" is added in Phase 6.
    EMAIL_DRIVER: z.enum(["log", "smtp"]).default("log"),
    SMTP_URL: z.string().optional(),
    EMAIL_FROM: z.string().min(3).default("Magda Kennedy <hello@localhost>"),
    // docs/brief.md §14. "local" writes to a mounted directory served by
    // app/uploads; "s3" is Cloudflare R2 (EU) or any S3 endpoint.
    MEDIA_DRIVER: z.enum(["local", "s3"]).default("local"),
    MEDIA_LOCAL_DIR: z.string().min(1).default("./storage"),
    MEDIA_PUBLIC_URL: z.url().optional(),
    S3_ACCOUNT_ID: z.string().optional(),
    S3_ENDPOINT: z.url().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.MEDIA_DRIVER === "s3") {
      for (const name of [
        "S3_BUCKET",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
        "MEDIA_PUBLIC_URL",
      ] as const) {
        if (!env[name])
          ctx.addIssue({
            code: "custom",
            path: [name],
            message: `${name} is required when MEDIA_DRIVER is "s3"`,
          })
      }
      if (!env.S3_ACCOUNT_ID && !env.S3_ENDPOINT) {
        ctx.addIssue({
          code: "custom",
          path: ["S3_ACCOUNT_ID"],
          message: "Set S3_ACCOUNT_ID (R2) or S3_ENDPOINT",
        })
      }
    }
    if (env.EMAIL_DRIVER === "smtp" && !env.SMTP_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_URL"],
        message: 'SMTP_URL is required when EMAIL_DRIVER is "smtp"',
      })
    }
    // next/image only allows an https media host (next.config.ts), and §15
    // keeps public URLs https; plain http is for a local emulator only.
    if (
      env.MEDIA_PUBLIC_URL &&
      env.SITE_ENV !== "development" &&
      !env.MEDIA_PUBLIC_URL.startsWith("https://")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["MEDIA_PUBLIC_URL"],
        message: `MEDIA_PUBLIC_URL must use https when SITE_ENV is "${env.SITE_ENV}"`,
      })
    }
    if (
      env.SITE_ENV !== "development" &&
      !env.BETTER_AUTH_URL.startsWith("https://")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: `BETTER_AUTH_URL must use https when SITE_ENV is "${env.SITE_ENV}"`,
      })
    }
    if (env.SITE_ENV === "production" && env.EMAIL_DRIVER === "log") {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_DRIVER"],
        message:
          'EMAIL_DRIVER "log" is not allowed when SITE_ENV is "production"',
      })
    }
  })

export type Env = z.infer<typeof EnvSchema>

let cached: Env | undefined

export function getEnv(): Env {
  if (cached) return cached
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(parsed.error)}`
    )
  }
  cached = parsed.data
  return cached
}

// Tests change process.env between cases; the app never calls this.
export function resetEnvForTests() {
  cached = undefined
}
