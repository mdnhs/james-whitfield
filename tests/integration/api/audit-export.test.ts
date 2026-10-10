import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, users } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("GET /audit/export.csv", () => {
  it("neutralises formulas and never exports ipHash or userAgent", async () => {
    const cookie = await cookieFor("admin")
    const admin = (await getDb().query.users.findFirst({
      where: eq(users.email, "admin@example.com"),
    }))!
    await audit(
      {
        userId: admin.id,
        email: admin.email,
        ip: "203.0.113.9",
        userAgent: "UA-SECRET",
      },
      {
        action: "page.publish",
        entityType: "page",
        entityId: "p1",
        summary: '=HYPERLINK("http://x")',
      }
    )
    await audit(
      { userId: admin.id, email: admin.email },
      {
        action: "page.publish",
        entityType: "page",
        entityId: "p2",
        summary: ' =cmd|"/c calc"!A1',
      }
    )
    const response = await adminRequest(
      "/audit/export.csv?entityType=page",
      cookie
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/csv")
    expect(response.headers.get("content-disposition")).toMatch(
      /attachment; filename="activity-\d{4}-\d{2}-\d{2}\.csv"/
    )
    expect(response.headers.get("cache-control")).toBe("no-store")
    const text = await response.text()
    const [header, ...lines] = text.split("\r\n")
    expect(header).toBe(
      "When,Who,Email,Viewing-as by,Action,Entity,Entity ID,Summary"
    )
    expect(text).toContain(`"'=HYPERLINK(""http://x"")"`)
    expect(text).toContain(`"' =cmd|""/c calc""!A1"`)
    expect(lines).toHaveLength(2)
    expect(text).not.toContain("UA-SECRET")
    expect(text).not.toContain("203.0.113.9")
    const [exported] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "audit.export"))
    expect(exported).toBeDefined()
  })

  it("caps the export at 10 000 rows, newest first", async () => {
    const cookie = await cookieFor("owner")
    const rows = Array.from({ length: 10_005 }, (_, i) => ({
      action: "seed.row",
      entityType: "seed",
      entityId: String(i),
      summary: `row ${i}`,
      createdAt: new Date(Date.UTC(2026, 0, 1) + i * 1000),
    }))
    for (let i = 0; i < rows.length; i += 2000) {
      await getDb()
        .insert(auditLogs)
        .values(rows.slice(i, i + 2000))
    }
    const text = await (
      await adminRequest("/audit/export.csv?action=seed.row", cookie)
    ).text()
    const lines = text.split("\r\n")
    expect(lines).toHaveLength(10_001)
    expect(lines[1]).toContain("row 10004")
  })

  it("is refused without audit.read", async () => {
    const cookie = await cookieFor("editor")
    expect((await adminRequest("/audit/export.csv", cookie)).status).toBe(403)
  })
})
