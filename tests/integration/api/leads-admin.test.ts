import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import {
  auditLogs,
  leadActivities,
  leads,
  newsletterSubscribers,
} from "@/server/db/schema"

import { adminRequest, cookieFor } from "../helpers/auth"
import { insertLead } from "../helpers/leads"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

// §7.2: [GET /, PATCH /:id, GET /export.csv, DELETE /:id]
const MATRIX: Record<RoleName, [number, number, number, number]> = {
  owner: [200, 200, 200, 200],
  admin: [200, 200, 200, 200],
  intake: [200, 200, 403, 403],
  editor: [403, 403, 403, 403],
  author: [403, 403, 403, 403],
  marketer: [403, 403, 403, 403],
  viewer: [403, 403, 403, 403],
}

describe.each(ROLE_NAMES)("leads RBAC for %s", (role) => {
  it(`→ ${MATRIX[role].join(", ")}`, async () => {
    const cookie = await cookieFor(role)
    const lead = await insertLead()
    const got = [
      (await adminRequest("/leads", cookie)).status,
      (
        await adminRequest(`/leads/${lead.id}`, cookie, {
          method: "PATCH",
          body: { status: "contacted" },
        })
      ).status,
      (await adminRequest("/leads/export.csv", cookie)).status,
      (await adminRequest(`/leads/${lead.id}`, cookie, { method: "DELETE" }))
        .status,
    ]
    expect(got).toEqual(MATRIX[role])
  })
})

describe("leads API", () => {
  it("lists the inbox without spam or messages, filters, searches and counts new", async () => {
    const cookie = await cookieFor("intake")
    await insertLead({
      name: "Ann",
      email: "ann@example.com",
      message: "SECRET",
    })
    await insertLead({
      name: "Bob",
      email: "bob@example.com",
      status: "contacted",
    })
    await insertLead({ name: "Spammy", status: "spam", spamReason: "honeypot" })
    const inbox = await (await adminRequest("/leads", cookie)).json()
    expect(inbox.total).toBe(2)
    expect(JSON.stringify(inbox)).not.toContain("SECRET")
    expect(
      (await (await adminRequest("/leads?folder=spam", cookie)).json()).items[0]
        .name
    ).toBe("Spammy")
    expect(
      (
        await (await adminRequest("/leads?status=contacted", cookie)).json()
      ).items.map((i: { name: string }) => i.name)
    ).toEqual(["Bob"])
    expect(
      (await (await adminRequest("/leads?q=ann%40example", cookie)).json())
        .total
    ).toBe(1)
    expect(await (await adminRequest("/leads/stats", cookie)).json()).toEqual({
      new: 1,
    })
  })

  it("changes status and assignee with a timeline, notes, and an audit without PII", async () => {
    const cookie = await cookieFor("intake")
    const owner = await cookieFor("owner")
    void owner
    const lead = await insertLead({
      email: "private@example.com",
      phone: "+353870000000",
      message: "SECRET",
    })
    const { items: people } = await (
      await adminRequest("/leads/assignees", cookie)
    ).json()
    expect(people.map((p: { name: string }) => p.name).sort()).toEqual([
      "intake",
      "owner",
    ])
    const patched = await (
      await adminRequest(`/leads/${lead.id}`, cookie, {
        method: "PATCH",
        body: { status: "contacted", assignedTo: people[0].id },
      })
    ).json()
    expect(patched.status).toBe("contacted")
    await adminRequest(`/leads/${lead.id}/notes`, cookie, {
      method: "POST",
      body: { body: "Called back" },
    })
    const detail = await (
      await adminRequest(`/leads/${lead.id}`, cookie)
    ).json()
    expect(detail.message).toBe("SECRET")
    expect(detail.activities.map((a: { type: string }) => a.type)).toEqual([
      "status",
      "assignment",
      "note",
    ])
    const audit = JSON.stringify(await getDb().select().from(auditLogs))
    for (const pii of [
      "private@example.com",
      "+353870000000",
      "SECRET",
      "Called back",
    ])
      expect(audit).not.toContain(pii)
  })

  it("exports CSV for owners and erases a lead with its activities", async () => {
    const cookie = await cookieFor("owner")
    const lead = await insertLead({ name: "=cmd()" })
    await getDb()
      .insert(leadActivities)
      .values({ leadId: lead.id, type: "note", body: "x" })
    const csv = await adminRequest("/leads/export.csv", cookie)
    expect(csv.headers.get("content-type")).toContain("text/csv")
    expect(csv.headers.get("content-disposition")).toMatch(
      /attachment; filename="enquiries-\d{4}-\d{2}-\d{2}\.csv"/
    )
    expect(await csv.text()).toContain(`"'=cmd()"`)
    expect(
      (await adminRequest(`/leads/${lead.id}`, cookie, { method: "DELETE" }))
        .status
    ).toBe(200)
    expect(await getDb().select().from(leadActivities)).toHaveLength(0)
    expect((await adminRequest(`/leads/${lead.id}`, cookie)).status).toBe(404)
  })

  it("DSAR exports and erases everything for one email, case-insensitively", async () => {
    const cookie = await cookieFor("admin")
    await insertLead({ email: "dsar@example.com" })
    await insertLead({ email: "DSAR@example.com" })
    await insertLead({ email: "other@example.com" })
    await getDb()
      .insert(newsletterSubscribers)
      .values({ email: "dsar@example.com", status: "confirmed" })
    const exported = await adminRequest(
      "/leads/dsar?email=Dsar%40Example.com",
      cookie
    )
    expect(exported.headers.get("content-disposition")).toContain("attachment")
    const data = await exported.json()
    expect(data.leads).toHaveLength(2)
    expect(data.newsletter.status).toBe("confirmed")
    expect(data.aiConversations).toEqual([])
    const erased = await (
      await adminRequest("/leads/dsar?email=dsar%40example.com", cookie, {
        method: "DELETE",
      })
    ).json()
    expect(erased).toEqual({ leads: 2, newsletter: 1 })
    expect(await getDb().select().from(leads)).toHaveLength(1)
    expect(
      JSON.stringify(await getDb().select().from(auditLogs))
    ).not.toContain("dsar@example.com")
  })

  it("refuses DSAR to intake and a marketer", async () => {
    for (const role of ["intake", "marketer"] as const) {
      const cookie = await cookieFor(role)
      expect(
        (await adminRequest("/leads/dsar?email=a%40b.co", cookie)).status
      ).toBe(403)
    }
  })
})
