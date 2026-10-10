import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

const SHA = "0123456789abcdef0123456789abcdef01234567"
const run = (dir: string, env: Record<string, string> = {}) =>
  execFileSync("sh", ["scripts/deployment-id.sh", dir], {
    env: { NODE_ENV: "test", PATH: process.env.PATH!, ...env },
    encoding: "utf8",
  }).trim()

function repo(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), "mk-dpl-"))
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    writeFileSync(path.join(dir, file), content)
  }
  return dir
}

describe("scripts/deployment-id.sh (Ruling R13)", () => {
  it("prefers the build arg", () => {
    expect(run(repo({}), { NEXT_DEPLOYMENT_ID: "abc123" })).toBe("abc123")
  })
  it("reads a branch ref", () => {
    expect(
      run(
        repo({
          ".git/HEAD": "ref: refs/heads/main\n",
          ".git/refs/heads/main": `${SHA}\n`,
        })
      )
    ).toBe(SHA)
  })
  it("reads packed refs", () => {
    expect(
      run(
        repo({
          ".git/HEAD": "ref: refs/heads/main\n",
          ".git/packed-refs": `# pack-refs\n${SHA} refs/heads/main\n`,
        })
      )
    ).toBe(SHA)
  })
  it("reads a detached HEAD", () => {
    expect(run(repo({ ".git/HEAD": `${SHA}\n` }))).toBe(SHA)
  })
  it("falls back to a build timestamp", () => {
    expect(run(repo({}))).toMatch(/^build-\d{14}$/)
  })
})
