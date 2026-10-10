import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { app } from "@/server/api/app"
import { closeDb } from "@/server/db/client"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("POST /public/csp-report", () => {
  it("logs a sanitised violation and answers 204", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const res = await app.request("/api/v1/public/csp-report", {
      method: "POST",
      headers: {
        "content-type": "application/csp-report",
        "x-real-ip": "198.51.100.7",
      },
      body: JSON.stringify({
        "csp-report": {
          "document-uri": "https://site.ie/newsletter/unsubscribe?token=secret",
          "violated-directive": "script-src-elem",
          "blocked-uri": "https://evil.example/x.js?a=1",
          "source-file": "https://x.test/_next/static/chunks/a.js?v=1",
        },
      }),
    })
    expect(res.status).toBe(204)
    const logged = warn.mock.calls.flat().join(" ")
    expect(logged).toContain("script-src-elem")
    expect(logged).toContain("https://evil.example/x.js")
    expect(logged).toContain("https://x.test/_next/static/chunks/a.js")
    expect(logged).not.toContain("v=1")
    expect(logged).not.toContain("secret")
    warn.mockRestore()
  })

  it("ignores junk", async () => {
    const res = await app.request("/api/v1/public/csp-report", {
      method: "POST",
      headers: { "content-type": "application/csp-report" },
      body: "not json",
    })
    expect(res.status).toBe(204)
  })
})
