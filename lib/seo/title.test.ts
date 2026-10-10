import { describe, expect, it } from "vitest"

import { documentTitle } from "./title"

const defaults = {
  titleTemplate: "%s | Magda Kennedy",
  defaultTitle: "Magda Kennedy: Hypnotherapist",
}

describe("documentTitle", () => {
  it("applies the template to the SEO title, then the entity title", () => {
    expect(
      documentTitle({ home: false, title: "About", seoTitle: null }, defaults)
    ).toBe("About | Magda Kennedy")
    expect(
      documentTitle(
        { home: false, title: "About", seoTitle: "About Magda" },
        defaults
      )
    ).toBe("About Magda | Magda Kennedy")
  })

  it("gives the home page the default title, untemplated", () => {
    expect(
      documentTitle({ home: true, title: "Home", seoTitle: null }, defaults)
    ).toBe("Magda Kennedy: Hypnotherapist")
    expect(
      documentTitle({ home: true, title: "Home", seoTitle: "Calm" }, defaults)
    ).toBe("Calm")
  })

  it("works without a template or a default title", () => {
    const bare = { titleTemplate: "", defaultTitle: "" }
    expect(
      documentTitle({ home: false, title: "About", seoTitle: null }, bare)
    ).toBe("About")
    expect(
      documentTitle({ home: true, title: "Home", seoTitle: null }, bare)
    ).toBe("Home")
  })
})

describe("documentTitle replacement", () => {
  it("keeps $ patterns in a title literal", () => {
    expect(
      documentTitle(
        { home: false, title: "Save $& more", seoTitle: null },
        defaults
      )
    ).toBe("Save $& more | Magda Kennedy")
  })
})
