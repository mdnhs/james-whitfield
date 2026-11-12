import { describe, expect, it } from "vitest"

import {
  CustomPagePath,
  isServicePagePath,
  PreviewPath,
} from "@/lib/content/page-path"

describe("page paths", () => {
  it.each(["/privacy-policy", "/team", "/services/hypnotherapy-for-anxiety"])(
    "accepts custom page %s",
    (p) => expect(CustomPagePath.safeParse(p).success).toBe(true)
  )
  it.each([
    "/admin",
    "/api",
    "/uploads",
    "/insights",
    "/a/b",
    "/__page",
    "/services",
    "/services/",
    "/services/a/b",
    "/services/Anxiety",
    "/other/x",
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
  it("tells service pages from one-segment pages", () => {
    expect(isServicePagePath("/services/x")).toBe(true)
    expect(isServicePagePath("/x")).toBe(false)
    expect(isServicePagePath("/services")).toBe(false)
  })
})
