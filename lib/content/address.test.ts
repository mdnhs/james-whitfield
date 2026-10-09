import { describe, expect, it } from "vitest"

import { clinicAddress, formatAddress, mapsUrl } from "./address"

const address = {
  lines: ["28 Merrion Square", "Dublin 2"],
  city: "Dublin",
  eircode: "D02 X285",
  country: "Ireland",
}

describe("address formatting", () => {
  it("prints the contact and clinic lines exactly as today", () => {
    expect(formatAddress(address)).toBe("28 Merrion Square, Dublin 2, D02 X285")
    // Today's clinic card has no comma before the country (a copy finding
    // for the client, brief §4.6); parity keeps it.
    expect(clinicAddress(address)).toBe(
      "28 Merrion Square, Dublin 2, D02 X285 Ireland"
    )
  })
  it("derives the directions link", () => {
    expect(mapsUrl(address)).toBe(
      "https://www.google.com/maps/search/?api=1&query=28%20Merrion%20Square%2C%20Dublin%202%2C%20D02%20X285"
    )
  })
})
