import { describe, expect, it } from "vitest"

import { CustomPagePath, PreviewPath } from "@/lib/content/page-path"

describe("page paths", () => {
  it.each(["/privacy-policy", "/team"])("accepts custom page %s", (p) =>
    expect(CustomPagePath.safeParse(p).success).toBe(true)
  )
  it.each([
    "/admin",
    "/api",
    "/uploads",
    "/insights",
    "/a/b",
    "/__page",
    "/Team",
    "/",
  ])("refuses custom page %s", (p) =>
    expect(CustomPagePath.safeParse(p).success).toBe(false)
  )
  it.each(["/", "/about", "/insights/calm-is-a-skill"])(
    "previews internal path %s",
    (p) => expect(PreviewPath.safeParse(p).success).toBe(true)
  )
  it.each([
    "//evil.example",
    "/\\evil",
    "https://evil.example",
    "/a?b=1",
    "about",
  ])("refuses preview target %s", (p) =>
    expect(PreviewPath.safeParse(p).success).toBe(false)
  )
})
