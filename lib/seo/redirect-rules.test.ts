import { describe, expect, it } from "vitest"

import { RedirectInput } from "./redirect-rules"

const parse = (v: Record<string, unknown>) =>
  RedirectInput.safeParse({ sourcePath: "/old", destination: "/new", ...v })

describe("RedirectInput", () => {
  it("normalises a trailing slash and defaults to 301", () => {
    const r = parse({ sourcePath: "/old-page/" })
    expect(r.success && r.data).toMatchObject({
      sourcePath: "/old-page",
      statusCode: 301,
      note: "",
    })
  })
  it("accepts legacy shapes", () => {
    expect(parse({ sourcePath: "/blog/2019/post.html" }).success).toBe(true)
    expect(parse({ destination: "/contact?plan=programme" }).success).toBe(true)
  })
  it.each([
    "/",
    "/admin/x",
    "/api",
    "/og/about",
    "/_next/x",
    "/uploads/a.png",
    "/images/a.png",
    "/robots.txt",
    "/newsletter/confirmed",
    "old",
    "/a b",
    "/old?x=1",
    "//evil",
  ])("rejects source %s", (sourcePath) =>
    expect(parse({ sourcePath }).success).toBe(false)
  )
  it.each(["https://evil.example", "//evil.example", "/\\evil", "new", "/a b"])(
    "rejects destination %s (Ruling R4)",
    (destination) => expect(parse({ destination }).success).toBe(false)
  )
  it("rejects other status codes", () => {
    expect(parse({ statusCode: 303 }).success).toBe(false)
  })
})
