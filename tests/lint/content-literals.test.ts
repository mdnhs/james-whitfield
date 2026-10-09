import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { siteSources } from "../css/site-sources"

const root = path.join(import.meta.dirname, "../..")
const FIXTURES = path.join(root, "server/db/seed/fixtures")

// Every string a fixture holds, however deep.
function strings(value: unknown, out: Set<string>) {
  if (typeof value === "string") out.add(value.trim())
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out))
  else if (value && typeof value === "object")
    Object.values(value).forEach((v) => strings(v, out))
}

// Comments may quote copy while explaining it; only rendered code counts.
// (Block comments and whole-line // comments; URLs in strings are untouched.)
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

// A one-word needle ("Testimonials") must not match inside an identifier.
function appears(source: string, needle: string) {
  const word = /\w/
  for (
    let at = source.indexOf(needle);
    at !== -1;
    at = source.indexOf(needle, at + 1)
  ) {
    const before = source[at - 1] ?? ""
    const after = source[at + needle.length] ?? ""
    if (
      !(word.test(needle[0]) && word.test(before)) &&
      !(word.test(needle.at(-1)!) && word.test(after))
    )
      return true
  }
  return false
}

describe("content literals", () => {
  it("no site component contains a fixture's copy (docs/plan.md Phase 3 acceptance)", async () => {
    const copy = new Set<string>()
    for (const file of await readdir(FIXTURES)) {
      strings(await import(path.join(FIXTURES, file)), copy)
    }
    // Paths, slugs and tiny labels ("Email") are not distinctive copy.
    const needles = [...copy].filter(
      (s) => s.length >= 12 && !s.startsWith("/") && !s.startsWith("#")
    )
    expect(needles.length).toBeGreaterThan(100)
    const offenders: string[] = []
    for (const file of (await siteSources()).filter(
      (f) => !f.startsWith("app/")
    )) {
      const source = stripComments(
        await readFile(path.join(root, file), "utf8")
      )
      for (const needle of needles)
        if (appears(source, needle)) offenders.push(`${file}: "${needle}"`)
    }
    expect(offenders).toEqual([])
  })
})
