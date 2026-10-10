import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: vi.fn(),
}))

import { eq } from "drizzle-orm"

import { ROLE_NAMES } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs } from "@/server/db/schema"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

const entry = (over: Record<string, unknown> = {}) => ({
  name: "Chat widget",
  placement: "body",
  src: "",
  inline: "window.chat=1",
  category: "marketing",
  routes: [],
  enabled: true,
  ...over,
})

beforeEach(resetDb)
afterAll(closeDb)

describe("custom code is owner-only (brief §7.2 code.update)", () => {
  it.each(ROLE_NAMES)("GET /globals/scripts as %s", async (role) => {
    const res = await adminRequest("/globals/scripts", await cookieFor(role))
    expect(res.status).toBe(role === "owner" ? 200 : 403)
  })
})

describe("saving snippets", () => {
  it("audits the change with a diff and keeps a revision to roll back to", async () => {
    const owner = await cookieFor("owner")
    const res = await adminRequest("/globals/scripts", owner, {
      method: "PUT",
      body: { version: 0, value: { snippets: [entry()] } },
    })
    expect(res.status).toBe(200)
    const [log] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, "scripts"))
    expect(log!.diff).toHaveProperty("snippets")
    const revisions = await (
      await adminRequest("/globals/scripts/revisions", owner)
    ).json()
    expect(revisions.items).toHaveLength(1)
  })

  it("keeps snippet bodies out of the audit diff", async () => {
    const owner = await cookieFor("owner")
    await adminRequest("/globals/scripts", owner, {
      method: "PUT",
      body: {
        version: 0,
        value: { snippets: [entry({ inline: "window.secret=abc123" })] },
      },
    })
    const [log] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, "scripts"))
    const text = JSON.stringify(log!.diff)
    expect(text).not.toContain("abc123")
    expect(text).toMatch(/redacted 20 chars sha256:[0-9a-f]{16}/)
  })

  it("refuses an external script outside the allowlist", async () => {
    const res = await adminRequest(
      "/globals/scripts",
      await cookieFor("owner"),
      {
        method: "PUT",
        body: {
          version: 0,
          value: {
            snippets: [entry({ inline: "", src: "https://evil.example/x.js" })],
          },
        },
      }
    )
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(Object.keys(error.fieldErrors).join(" ")).toContain("src")
  })

  it("an admin, who can do almost everything else, cannot write", async () => {
    const res = await adminRequest(
      "/globals/scripts",
      await cookieFor("admin"),
      {
        method: "PUT",
        body: { version: 0, value: { snippets: [entry()] } },
      }
    )
    expect(res.status).toBe(403)
  })
})
