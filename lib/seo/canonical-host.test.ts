import { describe, expect, it } from "vitest"

import {
  appHostFrom,
  canonicalHostRedirect,
  type CanonicalHostInput,
} from "./canonical-host"

const base: CanonicalHostInput = {
  host: "autopaintshop.ie",
  proto: "https",
  preferred: "apex",
  appHost: "autopaintshop.ie",
  pathAndSearch: "/about?x=1",
}
const run = (patch: Partial<CanonicalHostInput>) =>
  canonicalHostRedirect({ ...base, ...patch })

describe("appHostFrom", () => {
  it("strips www and ignores bad input", () => {
    expect(appHostFrom("https://www.autopaintshop.ie")).toBe("autopaintshop.ie")
    expect(appHostFrom("nope")).toBeNull()
    expect(appHostFrom(undefined)).toBeNull()
  })
})

describe("canonicalHostRedirect", () => {
  it("is a no-op when off, already right, or the host is not the site", () => {
    expect(run({ preferred: "off", host: "www.autopaintshop.ie" })).toBeNull()
    expect(run({})).toBeNull()
    expect(run({ host: "localhost:3000", proto: null })).toBeNull()
    expect(run({ host: "10.0.0.5", proto: "http" })).toBeNull()
    expect(run({ host: "preview.traefik.me", proto: "http" })).toBeNull()
    expect(run({ appHost: null, host: "www.autopaintshop.ie" })).toBeNull()
  })

  it("sends www to the bare host and http to https", () => {
    expect(run({ host: "www.autopaintshop.ie" })).toBe(
      "https://autopaintshop.ie/about?x=1"
    )
    expect(run({ proto: "http" })).toBe("https://autopaintshop.ie/about?x=1")
    expect(run({ host: "www.autopaintshop.ie", proto: "http" })).toBe(
      "https://autopaintshop.ie/about?x=1"
    )
  })

  it("sends the bare host to www when www is preferred", () => {
    expect(run({ preferred: "www" })).toBe(
      "https://www.autopaintshop.ie/about?x=1"
    )
    expect(run({ preferred: "www", host: "www.autopaintshop.ie" })).toBeNull()
    expect(
      run({ preferred: "www", host: "www.autopaintshop.ie", proto: "http" })
    ).toBe("https://www.autopaintshop.ie/about?x=1")
  })

  it("leaves the protocol alone when it is unknown, so it can never loop", () => {
    expect(run({ proto: null })).toBeNull()
  })

  it("ignores ports and case, and refuses an unsafe path", () => {
    expect(run({ host: "WWW.AutoPaintShop.ie:443" })).toBe(
      "https://autopaintshop.ie/about?x=1"
    )
    expect(
      run({ host: "www.autopaintshop.ie", pathAndSearch: "//evil.com" })
    ).toBeNull()
  })
})
