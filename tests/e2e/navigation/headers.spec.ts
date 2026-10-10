import { expect, test } from "@playwright/test"

test("public pages carry the Report-Only CSP and security headers", async ({
  request,
}) => {
  const res = await request.get("/")
  const h = res.headers()
  expect(h["content-security-policy-report-only"]).toContain(
    "https://www.googletagmanager.com"
  )
  expect(h["content-security-policy"]).toBeUndefined()
  expect(h["x-content-type-options"]).toBe("nosniff")
  expect(h["x-frame-options"]).toBe("SAMEORIGIN")
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin")
})

test("the reset page keeps no-referrer and the API is noindex", async ({
  request,
}) => {
  const reset = await request.get("/admin/reset-password?token=x")
  expect(reset.headers()["referrer-policy"]).toBe("no-referrer")
  const health = await request.get("/api/v1/health")
  expect(health.headers()["x-robots-tag"]).toBe("noindex, nofollow")
})
