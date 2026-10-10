import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { describe, expect, it } from "vitest"

// Review Focus 1: a database read in the public site must follow `await
// io()`, or `next build` (which has no database in CI) runs it.
describe("public-site database reads", () => {
  it("every file that calls a cached query awaits io() first", async () => {
    const dir = path.join(import.meta.dirname)
    const files = (await readdir(dir, { recursive: true })).filter(
      (f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts")
    )
    const offenders: string[] = []
    for (const file of files) {
      const source = await readFile(path.join(dir, file), "utf8")
      if (!source.includes("@/server/modules/content/queries")) continue
      if (file.endsWith("resolve-block.tsx")) continue // only rendered under CmsPage, which awaits io()
      if (file.endsWith("seo-defaults.ts")) continue // callers await io() (documented there)
      const reads =
        source.match(/export (default )?async function \w*[\s\S]*?\n}/g) ?? []
      for (const fn of reads) {
        if (/\bget[A-Z]\w*\(/.test(fn) && !/await io\(\)/.test(fn))
          offenders.push(`${file}: ${fn.split("(")[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
