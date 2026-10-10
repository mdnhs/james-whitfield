import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const yml = readFileSync(".github/workflows/ci.yml", "utf8")
const playwright = JSON.parse(
  readFileSync("node_modules/@playwright/test/package.json", "utf8")
).version

// The body of one top-level job (two-space indented key under `jobs:`).
export function job(name: string) {
  const match = yml.match(
    new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z][a-z-]*:\\n|$)`)
  )
  return match?.[1] ?? ""
}

describe("CI visual job (Ruling R11)", () => {
  it("runs in the Playwright image that matches the installed version", () => {
    expect(job("visual")).toContain(
      `image: mcr.microsoft.com/playwright:v${playwright}-noble`
    )
  })

  it("runs every parity and visual snapshot on all six projects", () => {
    const visual = job("visual")
    for (const project of [
      "desktop",
      "tablet",
      "mobile",
      "admin-desktop",
      "admin-tablet",
      "admin-mobile",
    ])
      expect(visual).toContain(`--project=${project}`)
    expect(visual).toContain(`--grep "parity:|visual:"`)
  })

  it("keeps snapshots out of the e2e job and runs the budgets there", () => {
    const e2e = job("e2e")
    expect(e2e).toContain(
      `--grep-invert "parity:|visual:|lighthouse:|budget:|perf:"`
    )
    expect(e2e).toContain(`--grep "lighthouse:|budget:"`)
  })

  it("can record baselines on demand and upload them", () => {
    expect(yml).toMatch(/workflow_dispatch:\n\s+inputs:\n\s+update_baselines:/)
    expect(job("visual")).toContain("tests/e2e/__screenshots__/linux")
  })

  it("the local script uses the same image", () => {
    expect(readFileSync("scripts/visual-baselines-linux.sh", "utf8")).toContain(
      "mcr.microsoft.com/playwright:v${version}-noble"
    )
  })
})
