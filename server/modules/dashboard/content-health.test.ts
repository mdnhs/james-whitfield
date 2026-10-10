import { describe, expect, it } from "vitest"

import type { SeoIssue } from "@/server/modules/seo/health"

import { contentGauge } from "./content-health"

const issue = (
  id: string,
  check: SeoIssue["check"],
  kind: SeoIssue["kind"] = "page"
) =>
  ({
    kind,
    id,
    title: id,
    path: "/",
    check,
    message: "",
    fixHref: "",
  }) as SeoIssue

describe("contentGauge (Ruling R4)", () => {
  it("buckets each live entity once: missing beats needs work", () => {
    const entities = ["a", "b", "c", "d"].map((id) => ({
      kind: "page" as const,
      id,
    }))
    const gauge = contentGauge(
      {
        issues: [
          issue("a", "description"),
          issue("a", "title-length"),
          issue("b", "h1"),
          issue("c", "alt-text"),
          // Media rows are not entities.
          issue("m1", "alt-text", "media"),
        ],
      },
      entities
    )
    expect(gauge).toEqual({ complete: 1, needsWork: 1, missing: 2, total: 4 })
  })

  it("is all zeros for a site with nothing live", () => {
    expect(contentGauge({ issues: [] }, [])).toEqual({
      complete: 0,
      needsWork: 0,
      missing: 0,
      total: 0,
    })
  })
})
