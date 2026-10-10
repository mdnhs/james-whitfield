// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { clickEvent } from "./clicks"

const html = (markup: string) => {
  document.body.innerHTML = markup
  return document.body
}

describe("clickEvent", () => {
  it("phone and email links", () => {
    html(
      '<a href="tel:+35312345678"><span id="t">Call</span></a><a id="m" href="mailto:hello@example.com">Mail</a>'
    )
    expect(clickEvent(document.getElementById("t"))).toEqual({
      event: "contact_click",
      params: { method: "phone" },
    })
    expect(clickEvent(document.getElementById("m"))).toEqual({
      event: "contact_click",
      params: { method: "email" },
    })
  })
  it("booking CTAs carry their location", () => {
    html(
      '<a href="/contact" data-track="book_appointment" data-cta-location="header"><span id="x">Book</span></a>'
    )
    expect(clickEvent(document.getElementById("x"))).toEqual({
      event: "book_appointment",
      params: { cta_location: "header" },
    })
  })
  it("ignores everything else", () => {
    html('<a id="a" href="/about">About</a><button id="b">x</button>')
    expect(clickEvent(document.getElementById("a"))).toBeNull()
    expect(clickEvent(document.getElementById("b"))).toBeNull()
    expect(clickEvent(null)).toBeNull()
  })
})
