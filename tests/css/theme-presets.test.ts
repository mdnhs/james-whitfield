// tests/css/theme-presets.test.ts
// R4: the engine's base tables must equal the CSS files, because the
// default theme emits nothing and the CSS is what visitors get.
import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { EVERGREEN_ADMIN, TEAL_SAGE_SITE } from "@/lib/theme/presets"
import { ADMIN_TOKENS, SITE_TOKENS } from "@/lib/theme/tokens"

const root = path.join(import.meta.dirname, "../..")
const read = (file: string) => readFileSync(path.join(root, file), "utf8")

function block(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`no ${selector} block`)
  const body = css.slice(start, css.indexOf("}", start))
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, n, v]) => [
      n,
      v.trim().toLowerCase(),
    ])
  )
}

describe("base tables match the CSS", () => {
  it("Teal Sage equals site.css @theme", () => {
    const theme = block(read("app/(site)/site.css"), "@theme")
    for (const token of SITE_TOKENS)
      expect(TEAL_SAGE_SITE[token], token).toBe(theme[`color-${token}`])
  })

  it("Evergreen equals admin.css light and dark", () => {
    const css = read("app/(admin)/admin.css")
    const light = block(css, ':root[data-theme="admin"]')
    const dark = block(css, ':root[data-theme="admin"].dark')
    expect(`${EVERGREEN_ADMIN.radius}rem`).toBe(light.radius)
    for (const token of ADMIN_TOKENS)
      expect(EVERGREEN_ADMIN.light[token], token).toBe(light[token])
    expect(EVERGREEN_ADMIN.dark).toEqual(
      Object.fromEntries(
        Object.entries(dark).filter(([n]) =>
          (ADMIN_TOKENS as readonly string[]).includes(n)
        )
      )
    )
  })
})
