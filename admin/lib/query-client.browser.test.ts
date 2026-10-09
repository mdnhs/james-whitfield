// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { getQueryClient } from "./query-client"

describe("getQueryClient in the browser", () => {
  it("reuses one client for the whole tab", () => {
    expect(getQueryClient()).toBe(getQueryClient())
  })
})
