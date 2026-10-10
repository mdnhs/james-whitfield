import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { BANNER_PREVIEW_STYLE } from "./banner-preview"

describe("BANNER_PREVIEW_STYLE", () => {
  const css = readFileSync(
    path.join(import.meta.dirname, "../../app/(site)/site.css"),
    "utf8"
  )
  const theme = css.slice(css.indexOf("@theme"))
  const entries = Object.entries(BANNER_PREVIEW_STYLE)

  it("covers the variables the banner uses", () => {
    const view = readFileSync(
      path.join(
        import.meta.dirname,
        "../../components/consent/consent-banner-view.tsx"
      ),
      "utf8"
    )
    for (const [, name] of view.matchAll(/\((--(?:color|font)-[a-z-]+)\)/g))
      expect(Object.keys(BANNER_PREVIEW_STYLE)).toContain(name)
  })

  it.each(entries)("%s matches site.css", (key, value) => {
    expect(key).toMatch(/^--(color|font)-/)
    expect(theme).toContain(`${key}: ${value};`)
  })
})
