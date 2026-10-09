import { describe, expect, it } from "vitest"

import { toFields } from "@/admin/components/schema-form/to-fields"
import { SETTINGS_PAGES } from "@/lib/content/global-access"
import { GLOBALS } from "@/lib/content/globals"

import { GLOBAL_FIELD_UI } from "./global-ui"

// Every settings document must render: no field without a widget, no group
// without children (a schema change that toFields cannot draw fails here).
describe("settings forms", () => {
  it.each(Object.values(SETTINGS_PAGES).flat())("%s renders", (key) => {
    const walk = (fields: ReturnType<typeof toFields>): void => {
      for (const field of fields) {
        expect(field.widget, field.name).toBeTruthy()
        if (field.widget === "group")
          expect(field.fields?.length, field.name).toBeGreaterThan(0)
        walk(field.fields ?? [])
        if (field.item) walk([field.item])
      }
    }
    walk(toFields(GLOBALS[key], GLOBAL_FIELD_UI[key]))
  })

  it("explains the unused clinic photo (P3 carry)", () => {
    const fields = toFields(GLOBALS.contact, GLOBAL_FIELD_UI.contact)
    const clinic = fields.find((f) => f.name === "clinic")!
    expect(
      clinic.fields!.find((f) => f.name === "clinic.photo")!.description
    ).toMatch(/Clinic block/)
  })
})
