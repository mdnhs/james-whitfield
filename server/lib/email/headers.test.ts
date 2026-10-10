import { describe, expect, it } from "vitest"

import { headerText, singleAddress } from "./headers"

describe("headerText", () => {
  it("strips CR/LF and control characters and collapses whitespace", () => {
    expect(headerText("Ann\r\nBcc: evil@example.com")).toBe(
      "Ann Bcc: evil@example.com"
    )
    expect(headerText("Ann\u0000\u001b\u007f \t Example\u2028")).toBe(
      "Ann Example"
    )
  })
})

describe("singleAddress", () => {
  it("accepts one well-formed address", () => {
    expect(singleAddress(" ann@example.com ")).toBe("ann@example.com")
  })
  it.each([
    "ann@example.com\r\nBcc: evil@example.com",
    "ann@example.com, evil@example.com",
    "Ann <ann@example.com>",
    "not-an-address",
    "",
  ])("rejects %j", (value) => {
    expect(singleAddress(value)).toBeUndefined()
  })
})
