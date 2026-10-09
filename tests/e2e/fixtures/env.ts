// E2E runs `next start` against its own database (created by docker init).
// Mail goes to Mailpit: `next start` runs with NODE_ENV=production, where the
// log driver never prints bodies, so reset links are read from its API.
export const E2E_PORT = 3100
export const E2E_ORIGIN = `http://localhost:${E2E_PORT}`
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025"

export const E2E_ENV = {
  SITE_URL: E2E_ORIGIN,
  SITE_ENV: "development",
  DATABASE_URL:
    process.env.DATABASE_URL_E2E ?? "postgres://mk:mk@localhost:5432/mk_e2e",
  BETTER_AUTH_URL: E2E_ORIGIN,
  BETTER_AUTH_SECRET: "e2e-secret-0123456789-abcdefghij-klmnopq",
  EMAIL_DRIVER: "smtp",
  SMTP_URL: process.env.SMTP_URL_E2E ?? "smtp://localhost:1025",
  EMAIL_FROM: "Magda Kennedy <hello@example.com>",
}
