import { describe, expect, it, vi } from "vitest"

import { currentPage, flushMetaPageView, track, type TrackEnv } from "./track"

function env(href: string, consent: { marketing: boolean } | null) {
  const url = new URL(href)
  const fbq = vi.fn()
  const window = {
    dataLayer: [] as unknown[],
    fbq,
    __mkConsent: consent && { analytics: true, ...consent },
    location: url,
  }
  const e: TrackEnv = {
    window: window as never,
    document: { title: "Contact | MK", referrer: "" } as never,
    newId: () => "evt-1",
  }
  return { e, window, fbq }
}

describe("track", () => {
  it("always pushes to the dataLayer, with or without consent", () => {
    const t = env("https://site.ie/contact", null)
    const id = track(
      { event: "contact_click", params: { method: "email" } },
      t.e
    )
    expect(id).toBe("evt-1")
    expect(t.window.dataLayer).toEqual([
      { event_params: null },
      {
        event: "contact_click",
        event_params: { method: "email", event_id: "evt-1" },
      },
    ])
    expect(t.fbq).not.toHaveBeenCalled()
  })

  it("mirrors to Meta with the same event id when marketing consent exists", () => {
    const t = env("https://site.ie/contact", { marketing: true })
    track(
      {
        event: "generate_lead",
        params: { lead_source: "contact_form", form_id: "contact" },
        eventId: "lead-1",
      },
      t.e
    )
    expect(t.fbq).toHaveBeenCalledWith(
      "track",
      "Lead",
      {},
      { eventID: "lead-1" }
    )
  })

  it("sends no Meta event when the URL has a query or is an article (Ruling R7)", () => {
    for (const href of [
      "https://site.ie/contact?topic=anxiety-stress",
      "https://site.ie/insights/hypnosis-for-panic",
      "https://site.ie/newsletter/unsubscribe?token=a",
    ]) {
      const t = env(href, { marketing: true })
      track({ event: "sign_up", params: { method: "newsletter" } }, t.e)
      expect(t.fbq).not.toHaveBeenCalled()
      expect(t.window.dataLayer).toHaveLength(2)
    }
  })

  it("never sends share to Meta, and never custom data", () => {
    const t = env("https://site.ie/insights", { marketing: true })
    track(
      {
        event: "share",
        params: { method: "copy_link", content_type: "article" },
      },
      t.e
    )
    expect(t.fbq).not.toHaveBeenCalled()
    track({ event: "contact_click", params: { method: "phone" } }, t.e)
    expect(t.fbq.mock.calls[0]![2]).toEqual({})
  })
})

describe("flushMetaPageView", () => {
  it("sends the page view Meta missed, once", () => {
    const t = env("https://site.ie/about", { marketing: true })
    const fbq = t.window.fbq
    // Pixel not loaded yet when the page view is pushed.
    ;(t.window as { fbq?: unknown }).fbq = undefined
    track(
      {
        event: "virtual_page_view",
        params: {
          page_location: "x",
          page_path: "/about",
          page_title: "About",
        },
      },
      t.e
    )
    ;(t.window as { fbq?: unknown }).fbq = fbq
    expect(flushMetaPageView(t.e)).toBe(true)
    expect(fbq).toHaveBeenCalledWith(
      "track",
      "PageView",
      {},
      { eventID: "evt-1" }
    )
    expect(flushMetaPageView(t.e)).toBe(false)
  })

  it("does not repeat a page view Meta already received", () => {
    const t = env("https://site.ie/about", { marketing: true })
    track(
      {
        event: "virtual_page_view",
        params: {
          page_location: "x",
          page_path: "/about",
          page_title: "About",
        },
      },
      t.e
    )
    expect(t.fbq).toHaveBeenCalledOnce()
    expect(flushMetaPageView(t.e)).toBe(false)
  })
})

describe("currentPage", () => {
  it("is sanitised", () => {
    const t = env("https://site.ie/insights/hypnosis-for-panic?x=1#y", null)
    expect(currentPage(t.e)).toEqual({
      location: "https://site.ie/insights",
      path: "/insights",
      title: "Insights",
      referrer: "",
    })
  })
})
