import path from "node:path"

import { ESLint } from "eslint"
import { describe, expect, it } from "vitest"

const eslint = new ESLint({ cwd: path.join(import.meta.dirname, "../..") })

async function restricted(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages.filter(
    (message) => message.ruleId === "@typescript-eslint/no-restricted-imports"
  )
}

const VALUE =
  'import { getDb } from "@/server/db/client"\nexport const db = getDb\n'
const TYPE =
  'import type { Actor } from "@/server/auth/actor"\nexport type A = Actor\n'

describe("client and shared code never import server modules", () => {
  it.each([
    "admin/lib/probe.ts",
    "components/probe.tsx",
    "lib/probe.ts",
    "features/probe.ts",
  ])(
    "refuses a value import in %s",
    async (file) => {
      expect(await restricted(VALUE, file)).toHaveLength(1)
    },
    30_000
  )

  it("allows type-only imports", async () => {
    expect(await restricted(TYPE, "admin/lib/probe.ts")).toHaveLength(0)
  }, 30_000)

  it("leaves routes free to call server code", async () => {
    expect(
      await restricted(VALUE, "app/(admin)/admin/(panel)/probe.tsx")
    ).toHaveLength(0)
  }, 30_000)
})

describe("other ways in", () => {
  it("allows an inline type specifier", async () => {
    const code =
      'import { type Actor } from "@/server/auth/actor"\nexport type A = Actor\n'
    expect(await restricted(code, "admin/lib/probe.ts")).toHaveLength(0)
  }, 30_000)

  it("refuses a re-export from a server module", async () => {
    const code = 'export { getDb } from "@/server/db/client"\n'
    expect(await restricted(code, "lib/probe.ts")).toHaveLength(1)
  }, 30_000)

  it("refuses a relative path into server", async () => {
    const code =
      'import { getDb } from "../server/db/client"\nexport const db = getDb\n'
    expect(await restricted(code, "lib/probe.ts")).toHaveLength(1)
  }, 30_000)

  it("covers hooks/", async () => {
    expect(await restricted(VALUE, "hooks/probe.ts")).toHaveLength(1)
  }, 30_000)
})
