import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { CUSTOM_SCRIPT_HOSTS } from "@/lib/tracking/hosts"

import { allowedSrc } from "./globals"

// The list is empty by design (Ruling R14); inject one host for these cases.
const hosts = CUSTOM_SCRIPT_HOSTS as string[]
beforeEach(() => {
  hosts.push("host.example")
})
afterEach(() => {
  hosts.length = 0
})

describe("allowedSrc", () => {
  it("allows https on the exact listed host", () => {
    expect(allowedSrc("https://host.example/widget.js")).toBe(true)
  })

  it.each([
    ["http", "http://host.example/x.js"],
    ["userinfo", "https://a@host.example/x.js"],
    ["userinfo with password", "https://a:b@host.example/x.js"],
    ["a port", "https://host.example:8443/x.js"],
    ["an unlisted host", "https://other.example/x.js"],
    ["a subdomain lookalike", "https://host.example.evil.com/x.js"],
    ["a prefix lookalike", "https://evilhost.example/x.js"],
    ["a userinfo trick", "https://host.example@evil.com/x.js"],
    ["not a url", "host.example/x.js"],
    ["protocol-relative", "//host.example/x.js"],
  ])("rejects %s", (_name, src) => {
    expect(allowedSrc(src)).toBe(false)
  })

  it("rejects everything while the list is empty", () => {
    hosts.length = 0
    expect(allowedSrc("https://host.example/x.js")).toBe(false)
  })
})
