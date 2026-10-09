import { describe, expect, it } from "vitest"

import { assertDisposableDatabase } from "./guard"

describe("assertDisposableDatabase", () => {
  it("allows _test and _e2e databases", () => {
    expect(() =>
      assertDisposableDatabase("postgres://u:p@h:5432/mk_test")
    ).not.toThrow()
    expect(() =>
      assertDisposableDatabase("postgres://u:p@h:5432/mk_e2e")
    ).not.toThrow()
  })

  it("refuses anything else", () => {
    expect(() =>
      assertDisposableDatabase("postgres://u:p@h:5432/mk_dev")
    ).toThrow(/Refusing/)
    expect(() =>
      assertDisposableDatabase("postgres://u:p@h:5432/prod")
    ).toThrow(/Refusing/)
  })
})
