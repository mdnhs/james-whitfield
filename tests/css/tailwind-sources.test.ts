// tests/css/tailwind-sources.test.ts
import { readFile } from "node:fs/promises"
import path from "node:path"

import tailwind from "@tailwindcss/postcss"
import postcss from "postcss"
import { describe, expect, it } from "vitest"

const root = path.join(import.meta.dirname, "../..")

async function build(file: string) {
  const from = path.join(root, file)
  const result = await postcss([tailwind({ base: root })]).process(
    await readFile(from, "utf8"),
    { from }
  )
  return result.css
}

// Arbitrary-value classes are generated for any file Tailwind scans, so they
// show exactly which sources each stylesheet reads.
// Used only in admin/modules/auth/two-factor-setup.tsx:
const ADMIN_ONLY = `.${["tracking", "\\[0\\.3em\\]"].join("-")}`
// Used only in features/how-it-works/components/how-it-works-section.tsx:
const FEATURES_ONLY = `.${["leading", "\\[1\\.18\\]"].join("-")}`

describe("Tailwind sources", () => {
  it("the site stylesheet ignores admin/**", async () => {
    const css = await build("app/(site)/site.css")
    expect(css).toContain(FEATURES_ONLY)
    expect(css).not.toContain(ADMIN_ONLY)
  }, 60_000)

  it("the admin stylesheet ignores features/**", async () => {
    const css = await build("app/(admin)/admin.css")
    expect(css).toContain(ADMIN_ONLY)
    expect(css).not.toContain(FEATURES_ONLY)
  }, 60_000)
})
