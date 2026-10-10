import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { EVENT_CATALOGUE } from "@/lib/tracking/events"

type Param = { key?: string; value?: string; list?: { map?: Param[] }[] }
type Tag = {
  name: string
  type: string
  paused?: boolean
  parameter: Param[]
  firingTriggerId: string[]
  consentSettings?: {
    consentStatus: string
    consentType?: { list: { value: string }[] }
  }
}

const raw = readFileSync(
  path.join(import.meta.dirname, "../../docs/gtm-container.json"),
  "utf8"
)
const container = JSON.parse(raw) as {
  exportFormatVersion: number
  containerVersion: {
    container: { usageContext: string[] }
    tag: Tag[]
    trigger: {
      triggerId: string
      customEventFilter: { parameter: Param[] }[]
    }[]
    variable: { name: string }[]
  }
}
const v = container.containerVersion
const INIT_ALL_PAGES = "2147479573"
const settingsOf = (tag: Tag, key: string) =>
  Object.fromEntries(
    (tag.parameter.find((p) => p.key === key)?.list ?? []).map((row) => [
      row.map!.find((m) => m.key === "parameter")!.value,
      row.map!.find((m) => m.key === "parameterValue")!.value,
    ])
  )

describe("docs/gtm-container.json", () => {
  it("is an importable GTM web export", () => {
    expect(container.exportFormatVersion).toBe(2)
    expect(v.container.usageContext).toEqual(["WEB"])
  })

  it("fires every tag from a trigger that exists", () => {
    const ids = new Set([INIT_ALL_PAGES, ...v.trigger.map((t) => t.triggerId)])
    for (const tag of v.tag)
      for (const id of tag.firingTriggerId) expect(ids).toContain(id)
  })

  it("resolves every {{variable}} it references", () => {
    const names = new Set(["_event", ...v.variable.map((x) => x.name)])
    for (const [, name] of raw.matchAll(/\{\{([^}]+)\}\}/g))
      expect(names).toContain(name)
  })

  it("has a trigger for exactly the event catalogue", () => {
    const events = v.trigger.map(
      (t) =>
        t.customEventFilter[0]!.parameter.find((p) => p.key === "arg1")!.value
    )
    expect(events.sort()).toEqual(EVENT_CATALOGUE.map((e) => e.event).sort())
  })

  it("configures GA4 without automatic page views, signals or ads personalisation", () => {
    const google = v.tag.find((t) => t.type === "googtag")!
    expect(settingsOf(google, "configSettingsTable")).toEqual({
      send_page_view: "false",
      allow_google_signals: "false",
      allow_ad_personalization_signals: "false",
      page_location: "{{DLV - page.location}}",
      page_title: "{{DLV - page.title}}",
      page_referrer: "{{DLV - page.referrer}}",
    })
    const pageView = v.tag.find(
      (t) =>
        t.type === "gaawe" && t.parameter.some((p) => p.value === "page_view")
    )!
    expect(pageView).toBeDefined()
    for (const tag of v.tag.filter((t) => t.type === "gaawe"))
      expect(
        tag.parameter.find((p) => p.key === "eventSettingsVariable")!.value
      ).toBe("{{GA4 - Shared event settings}}")
  })

  it("requires analytics_storage on the Google tag and every GA4 event tag", () => {
    const ga = v.tag.filter((t) => t.type === "googtag" || t.type === "gaawe")
    expect(ga.length).toBeGreaterThan(1)
    for (const tag of ga) {
      expect(tag.consentSettings!.consentStatus).toBe("NEEDED")
      expect(
        tag.consentSettings!.consentType!.list.map((x) => x.value)
      ).toEqual(["analytics_storage"])
    }
  })

  it("ships Meta tags paused and requiring additional consent (Ruling R7)", () => {
    const meta = v.tag.filter((t) => t.name.startsWith("Meta - "))
    expect(meta.length).toBeGreaterThan(0)
    for (const tag of meta) {
      expect(tag.paused).toBe(true)
      expect(tag.consentSettings!.consentStatus).toBe("NEEDED")
      expect(
        tag.consentSettings!.consentType!.list.map((x) => x.value)
      ).toContain("ad_storage")
    }
  })

  it("never passes URLs through or bypasses consent", () => {
    expect(raw).not.toMatch(/url_passthrough|noscript|ns\.html/)
  })
})
