import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const repo = path.join(import.meta.dirname, "../../../..")

function files(dir: string, match: (name: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return files(full, match)
    return match(entry.name) ? [full] : []
  })
}

const rel = (file: string) => path.relative(repo, file)

// proxy.ts only checks that a cookie exists. Every panel page and every
// Server Action must read the real session itself.
describe("panel pages read the session", () => {
  const pages = files(import.meta.dirname, (name) => name === "page.tsx")
  it.each(pages.map(rel))("%s", (file) => {
    expect(readFileSync(path.join(repo, file), "utf8")).toMatch(
      /\brequire(Actor|Permission)\(/
    )
  })
})

describe("Server Actions authorise themselves", () => {
  const sources = [
    ...files(path.join(repo, "admin"), (name) => /\.tsx?$/.test(name)),
    ...files(path.join(repo, "app/(admin)"), (name) => /\.tsx?$/.test(name)),
  ].filter((file) => /^\s*["']use server["']/m.test(readFileSync(file, "utf8")))

  // One test over the list (which is empty today) rather than it.each, so
  // the check exists before the first action does.
  it('every "use server" file calls requireActor or requirePermission', () => {
    const unguarded = sources
      .filter(
        (file) =>
          !/\brequire(Actor|Permission)\(/.test(readFileSync(file, "utf8"))
      )
      .map(rel)
    expect(unguarded).toEqual([])
  })
})
