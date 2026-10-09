// The one place that decides what env every test process sees.
export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? "postgres://mk:mk@localhost:5432/mk_test"

export const TEST_ENV = {
  NODE_ENV: "test",
  SITE_ENV: "development",
  SITE_URL: "http://localhost:3000",
  DATABASE_URL: TEST_DATABASE_URL,
  BETTER_AUTH_SECRET: "test-secret-0123456789-abcdefghij-klmnop",
  BETTER_AUTH_URL: "http://localhost:3000",
  EMAIL_DRIVER: "log",
  EMAIL_FROM: "Magda Kennedy <hello@example.com>",
}
