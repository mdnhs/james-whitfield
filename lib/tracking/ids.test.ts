import { describe, expect, it } from "vitest"

import { GA4_ID, GTM_ID, PIXEL_ID, validId } from "./ids"

describe("tracking IDs (brief §12.3)", () => {
  it("accepts the documented formats", () => {
    expect(validId(GTM_ID, "GTM-AB12CD3")).toBe("GTM-AB12CD3")
    expect(validId(GA4_ID, "G-ABC123XYZ")).toBe("G-ABC123XYZ")
    expect(validId(PIXEL_ID, "1234567890123456")).toBe("1234567890123456")
  })
  it.each([
    [GTM_ID, "gtm-ab12"],
    [GTM_ID, "GTM-AB 12"],
    [GTM_ID, 'GTM-ABC";alert(1)//'],
    [GA4_ID, "UA-1234-1"],
    [PIXEL_ID, "123456789"],
    [PIXEL_ID, "123456789012345678901"],
    [GTM_ID, ""],
    [GTM_ID, null],
  ])("rejects %s %j", (pattern, value) => {
    expect(validId(pattern, value)).toBeNull()
  })
})
