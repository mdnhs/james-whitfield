// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"

import { activePageRoot, findTarget } from "./page-root"

// jsdom has no layout, so nothing has client rects. Mark what a browser would
// render; Activity-hidden routes (display: none) have none.
function markRendered(selector: string) {
  document.querySelectorAll(selector).forEach((element) => {
    Object.defineProperty(element, "getClientRects", {
      value: () => ({ length: 1 }),
    })
  })
}

beforeEach(() => {
  document.body.innerHTML = ""
})

describe("activePageRoot", () => {
  it("skips page roots hidden by Activity", () => {
    document.body.innerHTML = `
      <main data-page-root id="previous"></main>
      <main data-page-root id="current"></main>`
    markRendered("#current")
    expect(activePageRoot()?.id).toBe("current")
  })

  it("returns null when no page root is rendered", () => {
    document.body.innerHTML = `<main data-page-root></main>`
    expect(activePageRoot()).toBeNull()
  })
})

describe("findTarget", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main data-page-root id="home-page">
        <section id="faq" data-from="home"></section>
      </main>
      <main data-page-root id="contact-page">
        <section id="faq" data-from="contact"></section>
        <button id="rail"></button>
      </main>
      <footer id="contact"></footer>`
    markRendered("#contact-page, #contact-page *, footer")
  })

  it("resolves a shared id inside the visible page", () => {
    expect(findTarget("faq")?.dataset.from).toBe("contact")
  })

  it("resolves inside the page that owns the clicked element", () => {
    // Both pages rendered (e.g. mid-transition): only `from` can tell them
    // apart, since the first rendered root and getElementById both pick home.
    markRendered("#home-page, #home-page *")
    const rail = document.getElementById("rail")
    expect(findTarget("faq", rail)?.dataset.from).toBe("contact")
  })

  it("falls back to rendered shared chrome such as the footer", () => {
    expect(findTarget("contact")?.tagName).toBe("FOOTER")
  })

  it("finds rendered chrome even when a hidden page has the same id first", () => {
    document.body.innerHTML = `
      <main data-page-root id="previous"><section id="contact"></section></main>
      <main data-page-root id="current"></main>
      <footer id="contact"></footer>`
    markRendered("#current, footer")
    expect(findTarget("contact")?.tagName).toBe("FOOTER")
  })

  it("ignores ids that only exist in hidden pages", () => {
    document.body.innerHTML = `
      <main data-page-root id="previous"><section id="story"></section></main>
      <main data-page-root id="current"></main>`
    markRendered("#current")
    expect(findTarget("story")).toBeNull()
  })
})
