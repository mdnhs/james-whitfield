import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { auditLogs } from "@/server/db/schema"

import {
  adminRequest,
  createUser,
  signIn,
  signInWithTwoFactor,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("GET /api/v1/admin/audit", () => {
  it("is forbidden without audit.read", async () => {
    await createUser("viewer")
    const cookie = await signIn("viewer@example.com")
    expect((await adminRequest("/audit", cookie)).status).toBe(403)
  })

  it("lists sign-ins newest first for an owner", async () => {
    await createUser("owner")
    await createUser("editor")
    await signIn("editor@example.com")
    const cookie = await signInWithTwoFactor("owner@example.com")

    const response = await adminRequest("/audit?page=1&pageSize=10", cookie)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.total).toBe(2)
    expect(body.items.map((item: { action: string }) => item.action)).toEqual([
      "auth.sign_in",
      "auth.sign_in",
    ])
    expect(new Date(body.items[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(body.items[1].createdAt).getTime()
    )
  })

  it("validates paging input", async () => {
    await createUser("owner")
    const cookie = await signInWithTwoFactor("owner@example.com")
    const response = await adminRequest("/audit?pageSize=500", cookie)
    expect(response.status).toBe(400)
    expect((await response.json()).error.fieldErrors.pageSize).toBeDefined()
  })

  async function entry(values: {
    actorId: string | null
    action: string
    createdAt: Date
  }) {
    await getDb()
      .insert(auditLogs)
      .values({
        ...values,
        entityType: "user",
        summary: values.action,
      })
  }

  async function ownerWithEntries() {
    const owner = await createUser("owner")
    const editor = await createUser("editor")
    const cookie = await signInWithTwoFactor("owner@example.com")
    await getDb().delete(auditLogs)
    // 23:30 UTC on 4 Oct is 00:30 on 5 Oct in Ireland (IST).
    await entry({
      actorId: owner.id,
      action: "user.invite",
      createdAt: new Date("2026-10-04T23:30:00Z"),
    })
    await entry({
      actorId: editor.id,
      action: "auth.sign_in",
      createdAt: new Date("2026-10-05T12:00:00Z"),
    })
    await entry({
      actorId: owner.id,
      action: "auth.sign_in",
      createdAt: new Date("2026-10-07T09:00:00Z"),
    })
    return { cookie, owner, editor }
  }

  const actions = (body: { items: { action: string }[] }) =>
    body.items.map((item) => item.action)

  it("filters by action", async () => {
    const { cookie } = await ownerWithEntries()
    const body = await (
      await adminRequest("/audit?action=auth.sign_in", cookie)
    ).json()
    expect(body.total).toBe(2)
    expect(actions(body)).toEqual(["auth.sign_in", "auth.sign_in"])
  })

  it("filters by actor and names them", async () => {
    const { cookie, editor } = await ownerWithEntries()
    const body = await (
      await adminRequest(`/audit?actor=${editor.id}`, cookie)
    ).json()
    expect(body.total).toBe(1)
    expect(body.items[0]).toMatchObject({
      actorId: editor.id,
      actorName: "editor",
    })
  })

  it("filters by Irish calendar days, inclusive", async () => {
    const { cookie } = await ownerWithEntries()
    const body = await (
      await adminRequest("/audit?from=2026-10-05&to=2026-10-05", cookie)
    ).json()
    expect(actions(body)).toEqual(["auth.sign_in", "user.invite"])
  })

  it("rejects a range that ends before it starts", async () => {
    const { cookie } = await ownerWithEntries()
    const response = await adminRequest(
      "/audit?from=2026-10-07&to=2026-10-05",
      cookie
    )
    expect(response.status).toBe(400)
    expect((await response.json()).error.fieldErrors.to).toBeDefined()
  })

  it("rejects a malformed actor id or date", async () => {
    const { cookie } = await ownerWithEntries()
    expect((await adminRequest("/audit?actor=nope", cookie)).status).toBe(400)
    expect((await adminRequest("/audit?from=2026-02-30", cookie)).status).toBe(
      400
    )
  })

  it("never exposes the IP hash or user agent", async () => {
    const { cookie } = await ownerWithEntries()
    const body = await (await adminRequest("/audit", cookie)).json()
    for (const item of body.items) {
      expect(item).not.toHaveProperty("ipHash")
      expect(item).not.toHaveProperty("userAgent")
    }
  })

  it("lists the actions and people to filter by", async () => {
    const { cookie, owner, editor } = await ownerWithEntries()
    const body = await (await adminRequest("/audit/facets", cookie)).json()
    expect(body.actions).toEqual(["auth.sign_in", "user.invite"])
    expect(body.actors.map((actor: { id: string }) => actor.id).sort()).toEqual(
      [owner.id, editor.id].sort()
    )
  })
})
