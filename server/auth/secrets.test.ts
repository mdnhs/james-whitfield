import { describe, expect, it } from "vitest"

import { parseAuthSecrets } from "./secrets"

const s = (n: number) => String(n).repeat(40)

describe("parseAuthSecrets", () => {
  it("reads Better Auth versioned list, newest first", () => {
    expect(parseAuthSecrets(`2:${s(2)}, 1:${s(1)}`)).toEqual([
      { version: 2, value: s(2) },
      { version: 1, value: s(1) },
    ])
    expect(parseAuthSecrets(undefined)).toBeUndefined()
    expect(parseAuthSecrets("")).toBeUndefined()
  })

  it.each([
    ["no version", s(1)],
    ["short secret", "1:short"],
    ["duplicate version", `1:${s(1)},1:${s(2)}`],
    ["negative version", `-1:${s(1)}`],
  ])("refuses %s", (_label, raw) => {
    expect(() => parseAuthSecrets(raw)).toThrow(/BETTER_AUTH_SECRETS/)
  })
})
