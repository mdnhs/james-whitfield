import "server-only"

import * as z from "zod"

// Validated lazily on first use, never at module scope: `next build` runs
// without production secrets or a database (docs/brief.md §5.6).
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SITE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  SITE_URL: z.url(),
  DATABASE_URL: z.url(),
  // "resend" is added in Phase 6.
  EMAIL_DRIVER: z.enum(["log", "smtp"]).default("log"),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().min(3).default("Magda Kennedy <hello@localhost>"),
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
