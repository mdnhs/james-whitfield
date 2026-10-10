import { describe, expect, it } from "vitest"

import { robotsFor } from "./robots"

const site = "https://magdakennedy.ie"

describe("robotsFor", () => {
  it("opens production except /admin and /api, with the sitemap", () => {
    expect(robotsFor("production", { robots: "index" }, site)).toEqual({
      rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
      sitemap: `${site}/sitemap.xml`,
    })
  })
  it.each(["staging", "development"] as const)(
    "disallows everything on %s (acceptance)",
    (env) => {
      expect(robotsFor(env, { robots: "index" }, site)).toEqual({
        rules: [{ userAgent: "*", disallow: "/" }],
      })
    }
  )
  it("disallows everything when the SEO policy is noindex", () => {
    expect(robotsFor("production", { robots: "noindex" }, site)).toEqual({
      rules: [{ userAgent: "*", disallow: "/" }],
    })
  })
})
