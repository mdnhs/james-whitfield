import { describe, expect, it } from "vitest"

import { captureAttribution, readAttribution } from "./attribution"

const storage = () => {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage
}
const at = (href: string) => new URL(href) as unknown as Location

describe("first-touch attribution", () => {
  it("keeps the first landing's UTM and referrer only", () => {
    const s = storage()
    captureAttribution(
      at("https://site.ie/insights/x?utm_source=google&utm_medium=cpc&gclid=1"),
      "https://google.com/",
      s
    )
    captureAttribution(
      at("https://site.ie/contact?utm_source=other"),
      "https://site.ie/insights/x",
      s
    )
    expect(readAttribution(s)).toEqual({
      referrer: "https://google.com/",
      landingPath: "/insights/x",
      utm: { utm_source: "google", utm_medium: "cpc" },
    })
  })
  it("ignores a same-site referrer and survives storage errors", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
    } as unknown as Storage
    expect(() =>
      captureAttribution(at("https://site.ie/"), "", broken)
    ).not.toThrow()
    expect(readAttribution(broken)).toEqual({
      referrer: "",
      landingPath: "",
      utm: {},
    })
  })
})
