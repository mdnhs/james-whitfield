import { describe, expect, it, vi } from "vitest"

import {
  clearTrackingCookies,
  saveConsent,
  subscribeConsent,
} from "./consent-client"
import { decodeConsent } from "./consent"

class FakeDoc {
  jar = ""
  writes: string[] = []
  get cookie() {
    return this.jar
  }
  set cookie(value: string) {
    this.writes.push(value)
  }
}

function env(over: { jar?: string; previous?: object | null } = {}) {
  const doc = new FakeDoc()
  doc.jar = over.jar ?? ""
  const window = {
    location: { hostname: "www.magdakennedy.ie" },
    dataLayer: [] as unknown[],
    gtag: vi.fn(),
    __loadGtm: vi.fn(),
    __mkConsent: over.previous ?? null,
  }
  const beacons: { url: string; body: string }[] = []
  return {
    doc,
    window,
    beacons,
    reload: vi.fn(),
    env: {
      window: window as never,
      doc,
      beacon: (url: string, body: Blob) => {
        void body.text().then((text) => beacons.push({ url, body: text }))
        return true
      },
      reload: () => undefined,
      now: () => Date.UTC(2026, 9, 10),
      newId: () => "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc",
    },
  }
}
const policy = { version: 3, months: 6 }
const flush = () => new Promise((r) => setTimeout(r, 0))

describe("saveConsent", () => {
  it("accept: writes the cookie, updates consent mode, loads GTM, logs", async () => {
    const t = env()
    const action = saveConsent(
      { analytics: true, marketing: true },
      "accept",
      policy,
      t.env
    )
    expect(action).toBe("accept")
    const written = t.doc.writes[0]!
    expect(written).toMatch(
      /^mk_consent=[^;]+; Max-Age=15552000; Path=\/; SameSite=Lax; Secure$/
    )
    expect(
      decodeConsent(written.slice("mk_consent=".length).split(";")[0])
    ).toEqual({
      id: "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc",
      v: 3,
      ts: Math.floor(Date.UTC(2026, 9, 10) / 1000),
      a: 1,
      m: 1,
    })
    expect(t.window.gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    })
    expect(t.window.dataLayer).toContainEqual({ event: "consent_update" })
    expect(t.window.__loadGtm).toHaveBeenCalledOnce()
    expect(t.window.__mkConsent).toEqual({ analytics: true, marketing: true })
    await flush()
    expect(t.beacons).toEqual([
      {
        url: "/api/v1/public/consent",
        body: JSON.stringify({
          id: "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc",
          v: 3,
          a: true,
          m: true,
          action: "accept",
        }),
      },
    ])
  })

  it("reject: denies, loads nothing", () => {
    const t = env()
    expect(
      saveConsent(
        { analytics: false, marketing: false },
        "reject",
        policy,
        t.env
      )
    ).toBe("reject")
    expect(t.window.__loadGtm).not.toHaveBeenCalled()
  })

  it("keeps the consent id across changes", () => {
    const t = env({
      jar:
        "mk_consent=" +
        encodeURIComponent(
          JSON.stringify({
            id: "11111111-1111-4111-8111-111111111111",
            v: 2,
            ts: 1,
            a: 0,
            m: 0,
          })
        ),
    })
    saveConsent({ analytics: true, marketing: false }, "custom", policy, t.env)
    expect(t.doc.writes[0]).toContain(
      encodeURIComponent('"id":"11111111-1111-4111-8111-111111111111"')
    )
  })

  it("withdrawal clears tracking cookies everywhere and reloads (Ruling R17)", () => {
    const t = env({
      previous: { analytics: true, marketing: true },
      jar: "_ga=1; _ga_ABC=2; _gcl_au=3; _fbp=4; _fbc=5; mk.session_token=keep",
    })
    const reload = vi.fn()
    const action = saveConsent(
      { analytics: true, marketing: false },
      "custom",
      policy,
      { ...t.env, reload }
    )
    expect(action).toBe("withdraw")
    expect(reload).toHaveBeenCalledOnce()
    expect(t.window.__loadGtm).not.toHaveBeenCalled()
    for (const name of ["_gcl_au", "_fbp", "_fbc"]) {
      expect(t.doc.writes).toContain(`${name}=; Max-Age=0; Path=/`)
      expect(t.doc.writes).toContain(
        `${name}=; Max-Age=0; Path=/; Domain=.magdakennedy.ie`
      )
    }
    expect(t.doc.writes.join("\n")).not.toContain("mk.session_token")
  })

  it("withdrawing marketing alone keeps _ga; withdrawing analytics clears it", () => {
    const m = env({
      previous: { analytics: true, marketing: true },
      jar: "_ga=1; _ga_ABC=2; _gid=9; _fbp=4",
    })
    saveConsent({ analytics: true, marketing: false }, "custom", policy, {
      ...m.env,
      reload: vi.fn(),
    })
    const written = m.doc.writes.join("\n")
    expect(written).toContain("_fbp=; Max-Age=0")
    expect(written).not.toMatch(/_ga|_gid/)

    const a = env({
      previous: { analytics: true, marketing: true },
      jar: "_ga=1; _ga_ABC=2; _gid=9; _fbp=4",
    })
    saveConsent({ analytics: false, marketing: true }, "custom", policy, {
      ...a.env,
      reload: vi.fn(),
    })
    const cleared = a.doc.writes.join("\n")
    for (const name of ["_ga", "_ga_ABC", "_gid"])
      expect(cleared).toContain(`${name}=; Max-Age=0`)
    expect(cleared).not.toContain("_fbp")
  })

  it("reject after lapsed consent still clears stale tracking cookies", () => {
    const t = env({
      previous: null,
      jar: "_ga=1; _ga_ABC=2; _gid=9; _gcl_au=3; _fbp=4; _fbc=5; theme=dark",
    })
    const reload = vi.fn()
    const action = saveConsent(
      { analytics: false, marketing: false },
      "reject",
      policy,
      { ...t.env, reload }
    )
    expect(action).toBe("reject")
    expect(reload).not.toHaveBeenCalled()
    for (const name of ["_ga", "_ga_ABC", "_gid", "_gcl_au", "_fbp", "_fbc"])
      expect(t.doc.writes).toContain(`${name}=; Max-Age=0; Path=/`)
    expect(t.doc.writes.join("\n")).not.toContain("theme")
  })

  it("accept leaves existing tracking cookies alone", () => {
    const t = env({ jar: "_ga=1" })
    saveConsent({ analytics: true, marketing: true }, "accept", policy, t.env)
    expect(t.doc.writes.join("\n")).not.toContain("_ga=;")
  })

  it("notifies subscribers after a non-withdrawing save", () => {
    const t = env()
    const listener = vi.fn()
    const off = subscribeConsent(listener)
    saveConsent({ analytics: false, marketing: true }, "custom", policy, t.env)
    expect(listener).toHaveBeenCalledOnce()
    off()
  })
})

describe("clearTrackingCookies", () => {
  it("only touches tracking cookies", () => {
    const doc = new FakeDoc()
    doc.jar = "mk_consent=x; theme=dark"
    clearTrackingCookies(doc, "localhost")
    expect(doc.writes).toEqual([])
  })
})
