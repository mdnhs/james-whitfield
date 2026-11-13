// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { linkify } from "./linkify"

function links(text: string) {
  const { container } = render(<p>{linkify(text)}</p>)
  return {
    text: container.textContent,
    anchors: [...container.querySelectorAll("a")].map((a) => ({
      label: a.textContent,
      href: a.getAttribute("href"),
      target: a.getAttribute("target"),
    })),
  }
}

describe("linkify", () => {
  it("links phone and WhatsApp numbers from an AI reply", () => {
    const body =
      "Great! Here are the best ways to reach us:\n\n📞 Phone: 0852785974\n💬 WhatsApp: +353 894400191\n\nLet me know."
    const r = links(body)
    expect(r.text).toBe(body)
    expect(r.anchors).toEqual([
      { label: "0852785974", href: "tel:0852785974", target: null },
      {
        label: "+353 894400191",
        href: "https://wa.me/353894400191",
        target: "_blank",
      },
    ])
  })

  it("links emails to mailto", () => {
    const r = links("Email us at hello@autopaintshop.ie.")
    expect(r.anchors).toEqual([
      {
        label: "hello@autopaintshop.ie",
        href: "mailto:hello@autopaintshop.ie",
        target: null,
      },
    ])
    expect(r.text).toBe("Email us at hello@autopaintshop.ie.")
  })

  it("turns a national WhatsApp number into the international form", () => {
    expect(links("WhatsApp 089 440 0191").anchors[0]?.href).toBe(
      "https://wa.me/353894400191"
    )
  })

  it("keeps the + in tel links and ignores short numbers and years", () => {
    const r = links("Call +353 1 234 5678. Open 2019 - 2021, bay 12345.")
    expect(r.anchors.map((a) => a.href)).toEqual(["tel:+35312345678"])
  })

  it("does not join numbers across lines", () => {
    const r = links("Phone: 0852785974\n0861234567")
    expect(r.anchors.map((a) => a.href)).toEqual([
      "tel:0852785974",
      "tel:0861234567",
    ])
  })
})
