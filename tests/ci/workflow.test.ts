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

describe("deploy job (Ruling R12)", () => {
  const deploy = job("deploy")

  it("deploys only after check, e2e and visual pass, and only on pushes to main or feat/platform", () => {
    expect(deploy).toContain("needs: [check, e2e, visual]")
    expect(deploy).toContain("github.event_name == 'push'")
    expect(deploy).toContain("refs/heads/main")
    expect(deploy).toContain("refs/heads/feat/platform")
    expect(deploy).not.toContain("pull_request")
  })

  it("targets the GitHub environment of the branch", () => {
    expect(deploy).toContain(
      "environment: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}"
    )
  })

  it("skips with a warning when the Dokploy secrets are missing", () => {
    expect(deploy).toContain("::warning::")
    expect(deploy).toMatch(/exit 0/)
    // Secrets reach curl through env, never inline in the command.
    expect(deploy).not.toMatch(/curl[^\n]*\$\{\{ secrets\./)
  })

  it("calls Dokploy's deploy API with the application id", () => {
    expect(deploy).toContain('"$DOKPLOY_URL/api/application.deploy"')
    expect(deploy).toContain("x-api-key: $DOKPLOY_API_KEY")
  })
})
