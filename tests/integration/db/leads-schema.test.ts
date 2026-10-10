import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import {
  leadActivities,
  leads,
  newsletterSubscribers,
} from "@/server/db/schema"

import { insertLead } from "../helpers/leads"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("enquiry schema", () => {
  it("refuses unknown statuses and activity types", async () => {
    await expect(insertLead({ status: "maybe" as never })).rejects.toThrow()
    const lead = await insertLead()
    await expect(
      getDb()
        .insert(leadActivities)
        .values({ leadId: lead.id, type: "poke" as never })
    ).rejects.toThrow()
  })
  it("cascades activities when a lead is erased", async () => {
    const lead = await insertLead()
    await getDb()
      .insert(leadActivities)
      .values({ leadId: lead.id, type: "note", body: "x" })
    await getDb().delete(leads)
    expect(await getDb().select().from(leadActivities)).toHaveLength(0)
  })
  it("keeps newsletter emails unique and lower-case", async () => {
    await getDb()
      .insert(newsletterSubscribers)
      .values({ email: "a@example.com" })
    await expect(
      getDb().insert(newsletterSubscribers).values({ email: "a@example.com" })
    ).rejects.toThrow()
    await expect(
      getDb().insert(newsletterSubscribers).values({ email: "B@example.com" })
    ).rejects.toThrow()
  })
})
