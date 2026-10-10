import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

// Creating a page expires cache tags, which needs a Next request scope.
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: vi.fn(),
}))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { app } from "@/server/api/app"
import { closeDb } from "@/server/db/client"

import {
  adminRequest,
  createUser,
  ORIGIN,
  signIn,
  signInWithTwoFactor,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

async function cookieFor(role: RoleName) {
  await createUser(role)
  const email = `${role}@example.com`
  return role === "owner" || role === "admin"
    ? signInWithTwoFactor(email)
    : signIn(email)
}

// Written out from docs/brief.md §7.2 rather than derived from the role
// definitions, so drift between code and spec fails here. 400 on invite
// means "past can(), stopped by validation" (the body is empty).
const MATRIX: Record<RoleName, { audit: number; invite: number }> = {
  owner: { audit: 200, invite: 400 },
  admin: { audit: 200, invite: 400 },
  editor: { audit: 403, invite: 403 },
  author: { audit: 403, invite: 403 },
  marketer: { audit: 403, invite: 403 },
  intake: { audit: 403, invite: 403 },
  viewer: { audit: 403, invite: 403 },
}

describe.each(ROLE_NAMES)("can() for %s", (role) => {
  it(`GET /audit → ${MATRIX[role].audit}`, async () => {
    const response = await adminRequest("/audit", await cookieFor(role))
    expect(response.status).toBe(MATRIX[role].audit)
    if (response.status === 403) {
      expect((await response.json()).error.code).toBe("FORBIDDEN")
    }
  })

  it(`POST /users/invite → ${MATRIX[role].invite}`, async () => {
    const response = await adminRequest(
      "/users/invite",
      await cookieFor(role),
      { method: "POST", body: {} }
    )
    expect(response.status).toBe(MATRIX[role].invite)
  })

  it("GET /search → 200 (dashboard.view)", async () => {
    const response = await adminRequest("/search", await cookieFor(role))
    expect(response.status).toBe(200)
  })

  // People and audit details only for user.list / audit.read (owner and
  // admin, docs/brief.md §7.2); every other role gets aggregates.
  it(`GET /dashboard → 200, ${MATRIX[role].audit === 200 ? "details" : "aggregates only"}`, async () => {
    const response = await adminRequest("/dashboard", await cookieFor(role))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.activeUsers).toEqual({
      value: expect.any(Number),
      previous: expect.any(Number),
    })
    expect(body.signIns.days).toHaveLength(7)
    if (MATRIX[role].audit === 200) {
      expect(body.security).toEqual({
        protected: expect.any(Number),
        requiredMissing: expect.any(Number),
        optionalMissing: expect.any(Number),
        total: expect.any(Number),
      })
      expect(body.changes).toEqual({
        value: expect.any(Number),
        previous: expect.any(Number),
      })
      expect(body.recentActivity).toEqual(expect.any(Array))
      expect(body.recentActivity.length).toBeGreaterThan(0)
      expect(body.nextUp.map((item: { id: string }) => item.id)).toEqual([
        "two-factor",
        "invite",
      ])
    } else {
      expect(body.security).toBeNull()
      expect(body.changes).toBeNull()
      expect(body.recentActivity).toBeNull()
      expect(body.nextUp.map((item: { id: string }) => item.id)).toEqual([
        "two-factor",
      ])
    }
  })
})

// docs/brief.md §7.2 page rows. 404 means "past can(), no such page"; the
// bodies are valid so validation never hides the permission check.
const WRITER = { read: 200, write: 404, create: 201, seo: 404 }
const PAGES: Record<
  RoleName,
  { read: number; write: number; create: number; seo: number }
> = {
  owner: WRITER,
  admin: WRITER,
  editor: WRITER,
  author: { read: 200, write: 403, create: 403, seo: 403 },
  marketer: { read: 200, write: 403, create: 403, seo: 404 },
  intake: { read: 403, write: 403, create: 403, seo: 403 },
  viewer: { read: 200, write: 403, create: 403, seo: 403 },
}

describe.each(ROLE_NAMES)("pages routes for %s", (role) => {
  const missing = crypto.randomUUID()
  const expected = PAGES[role]

  it(`GET /pages → ${expected.read}`, async () => {
    const response = await adminRequest("/pages", await cookieFor(role))
    expect(response.status).toBe(expected.read)
  })

  it(`POST /pages → ${expected.create}`, async () => {
    const response = await adminRequest("/pages", await cookieFor(role), {
      method: "POST",
      body: { path: "/team", title: "Team" },
    })
    expect(response.status).toBe(expected.create)
  })

  it.each([
    [
      "PATCH",
      `/pages/${missing}/draft`,
      { version: 1, document: { blocks: [] } },
    ],
    ["POST", `/pages/${missing}/publish`, { version: 1 }],
    ["POST", `/pages/${missing}/discard`, { version: 1 }],
    ["POST", `/pages/${missing}/revisions/${missing}/restore`, { version: 1 }],
    ["DELETE", `/pages/${missing}`, undefined],
    ["PATCH", `/pages/${missing}/path`, { path: "/moved" }],
  ])(`%s %s → ${expected.write}`, async (method, path, body) => {
    const response = await adminRequest(path, await cookieFor(role), {
      method,
      body,
    })
    expect(response.status).toBe(expected.write)
  })

  it(`PATCH /pages/:id/seo → ${expected.seo}`, async () => {
    const response = await adminRequest(
      `/pages/${missing}/seo`,
      await cookieFor(role),
      { method: "PATCH", body: { seo: { noindex: true } } }
    )
    expect(response.status).toBe(expected.seo)
  })
})

// docs/brief.md §7.2 redirect rows: read and manage → owner, admin, editor,
// marketer. 404 on PATCH/DELETE means "past can(), no such redirect".
const MANAGES_REDIRECTS = new Set<RoleName>([
  "owner",
  "admin",
  "editor",
  "marketer",
])

describe.each(ROLE_NAMES)("seo redirect routes for %s", (role) => {
  const missing = crypto.randomUUID()
  const allowed = MANAGES_REDIRECTS.has(role)

  it.each([
    ["GET", "/seo/redirects", undefined, 200],
    ["POST", "/seo/redirects", { sourcePath: "/old", destination: "/" }, 201],
    ["PATCH", `/seo/redirects/${missing}`, { isActive: false }, 404],
    ["DELETE", `/seo/redirects/${missing}`, undefined, 404],
  ] as const)("%s %s", async (method, path, body, ok) => {
    const response = await adminRequest(path, await cookieFor(role), {
      method,
      body,
    })
    expect(response.status).toBe(allowed ? ok : 403)
  })
})

// Every role manages its own account (docs/brief.md §7.2): the same gate as
// the Account page. 404 on DELETE means "past can(), no such device of yours".
describe.each(ROLE_NAMES)("account self-service for %s", (role) => {
  it("GET /account/sessions → 200", async () => {
    const response = await adminRequest(
      "/account/sessions",
      await cookieFor(role)
    )
    expect(response.status).toBe(200)
  })

  it("DELETE /account/sessions/:id → 404 for an unknown device", async () => {
    const response = await adminRequest(
      `/account/sessions/${crypto.randomUUID()}`,
      await cookieFor(role),
      { method: "DELETE" }
    )
    expect(response.status).toBe(404)
  })

  it("POST /account/sessions/revoke-others → 200", async () => {
    const response = await adminRequest(
      "/account/sessions/revoke-others",
      await cookieFor(role),
      { method: "POST" }
    )
    expect(response.status).toBe(200)
  })
})

// Mounted after twoFactorComplete (server/api/routes/admin.ts): an owner or
// admin without two-factor reaches /me and two-factor setup, nothing else.
describe.each(["owner", "admin"] as const)(
  "an %s without two-factor",
  (role) => {
    it.each([
      ["GET", "/dashboard"],
      ["GET", "/search"],
      ["GET", "/audit"],
      ["GET", "/audit/facets"],
      ["GET", "/pages"],
      ["GET", "/account/sessions"],
      ["DELETE", `/account/sessions/${crypto.randomUUID()}`],
      ["POST", "/account/sessions/revoke-others"],
    ])("%s %s → 403 TWO_FACTOR_REQUIRED", async (method, path) => {
      await createUser(role)
      const response = await adminRequest(
        path,
        await signIn(`${role}@example.com`),
        { method }
      )
      expect(response.status).toBe(403)
      expect((await response.json()).error.code).toBe("TWO_FACTOR_REQUIRED")
    })
  }
)

describe("can() without a session", () => {
  it.each(["/me", "/audit"])("GET %s → 401", async (path) => {
    expect((await adminRequest(path, "")).status).toBe(401)
  })
})

// docs/brief.md §6.4/§7.2 globals rows, one per permission family: identity
// and notifications are settings.read (owner/admin), contact is globals.read,
// seo is seo.read. 200 = past can(); the body is a defaults document.
const GLOBALS_READ: Record<
  RoleName,
  { site: number; notifications: number; contact: number; seo: number }
> = {
  owner: { site: 200, notifications: 200, contact: 200, seo: 200 },
  admin: { site: 200, notifications: 200, contact: 200, seo: 200 },
  editor: { site: 403, notifications: 403, contact: 200, seo: 200 },
  author: { site: 403, notifications: 403, contact: 403, seo: 403 },
  marketer: { site: 403, notifications: 403, contact: 200, seo: 200 },
  intake: { site: 403, notifications: 403, contact: 403, seo: 403 },
  viewer: { site: 403, notifications: 403, contact: 200, seo: 200 },
}

describe.each(ROLE_NAMES)("globals read routes for %s", (role) => {
  it.each(["site", "notifications", "contact", "seo"] as const)(
    "GET /globals/%s",
    async (key) => {
      const response = await adminRequest(
        `/globals/${key}`,
        await cookieFor(role)
      )
      expect(response.status).toBe(GLOBALS_READ[role][key])
    }
  )
})

// docs/brief.md §7.2 collection rows. 404 means "past can(), no such item";
// 400 on reorder means "past can(), incomplete id list".
const COLLECTION_WRITER = { read: 200, write: 404, reorder: 400 }
const COLLECTIONS: Record<
  RoleName,
  { read: number; write: number; reorder: number }
> = {
  owner: COLLECTION_WRITER,
  admin: COLLECTION_WRITER,
  editor: COLLECTION_WRITER,
  author: { read: 200, write: 403, reorder: 403 },
  marketer: { read: 200, write: 403, reorder: 403 },
  intake: { read: 403, write: 403, reorder: 403 },
  viewer: { read: 200, write: 403, reorder: 403 },
}

describe.each(ROLE_NAMES)("collections routes for %s", (role) => {
  const missing = crypto.randomUUID()
  const expected = COLLECTIONS[role]

  it.each(["/collections/faqs", "/collections/faqs/options"])(
    `GET %s → ${expected.read}`,
    async (path) => {
      const response = await adminRequest(path, await cookieFor(role))
      expect(response.status).toBe(expected.read)
    }
  )

  it(`PATCH /collections/faqs/order → ${expected.reorder}`, async () => {
    const response = await adminRequest(
      "/collections/faqs/order",
      await cookieFor(role),
      { method: "PATCH", body: { ids: [missing] } }
    )
    expect(response.status).toBe(expected.reorder)
  })

  it.each([
    ["PATCH", `/collections/faqs/${missing}`, { version: 1, values: {} }],
    ["DELETE", `/collections/faqs/${missing}`, undefined],
  ])(`%s %s → ${expected.write}`, async (method, path, body) => {
    const response = await adminRequest(path, await cookieFor(role), {
      method,
      body,
    })
    expect(response.status).toBe(expected.write)
  })
})

// docs/brief.md §7.2 globals write rows (contact is globals.update:
// owner/admin/editor). Revision list is a read; restore is an update. 404 on
// restore means "past can(), no such version".
const GLOBALS_WRITER = { revisions: 200, put: 200, restore: 404 }
const GLOBALS_WRITE: Record<
  RoleName,
  { revisions: number; put: number; restore: number }
> = {
  owner: GLOBALS_WRITER,
  admin: GLOBALS_WRITER,
  editor: GLOBALS_WRITER,
  author: { revisions: 403, put: 403, restore: 403 },
  marketer: { revisions: 200, put: 403, restore: 403 },
  intake: { revisions: 403, put: 403, restore: 403 },
  viewer: { revisions: 200, put: 403, restore: 403 },
}

describe.each(ROLE_NAMES)("globals write routes for %s", (role) => {
  const expected = GLOBALS_WRITE[role]

  it(`GET /globals/contact/revisions → ${expected.revisions}`, async () => {
    const response = await adminRequest(
      "/globals/contact/revisions",
      await cookieFor(role)
    )
    expect(response.status).toBe(expected.revisions)
  })

  it(`PUT /globals/contact → ${expected.put}`, async () => {
    const response = await adminRequest(
      "/globals/contact",
      await cookieFor(role),
      { method: "PUT", body: { version: 0, value: {} } }
    )
    expect(response.status).toBe(expected.put)
  })

  it(`POST /globals/contact/revisions/:rev/restore → ${expected.restore}`, async () => {
    const response = await adminRequest(
      `/globals/contact/revisions/${crypto.randomUUID()}/restore`,
      await cookieFor(role),
      { method: "POST", body: { version: 0 } }
    )
    expect(response.status).toBe(expected.restore)
  })
})

// POST /collections/:name (docs/brief.md §7.2 collection.create). 400 means
// "past can(), empty body fails validation".
describe.each(ROLE_NAMES)("collection create for %s", (role) => {
  const status = ["owner", "admin", "editor"].includes(role) ? 400 : 403
  it(`POST /collections/faqs → ${status}`, async () => {
    const response = await adminRequest(
      "/collections/faqs",
      await cookieFor(role),
      { method: "POST", body: {} }
    )
    expect(response.status).toBe(status)
  })
})

// docs/brief.md §7.2 media rows. 404 means "past can(), no such file"; 400
// means "past can(), no file in the form". The author's "own" limit is
// covered in media.test.ts, where real files exist.
const MEDIA_FULL = { list: 200, upload: 400, update: 404, remove: 404 }
const MEDIA: Record<
  RoleName,
  { list: number; upload: number; update: number; remove: number }
> = {
  owner: MEDIA_FULL,
  admin: MEDIA_FULL,
  editor: MEDIA_FULL,
  author: { list: 200, upload: 400, update: 404, remove: 403 },
  marketer: { list: 200, upload: 400, update: 404, remove: 403 },
  intake: { list: 403, upload: 403, update: 403, remove: 403 },
  viewer: { list: 403, upload: 403, update: 403, remove: 403 },
}

describe.each(ROLE_NAMES)("media routes for %s", (role) => {
  const missing = crypto.randomUUID()
  const expected = MEDIA[role]
  const emptyForm = async (path: string) =>
    app.request(`/api/v1/admin${path}`, {
      method: "POST",
      headers: { cookie: await cookieFor(role), origin: ORIGIN },
      body: new FormData(),
    })

  it(`GET /media → ${expected.list}`, async () => {
    const response = await adminRequest("/media", await cookieFor(role))
    expect(response.status).toBe(expected.list)
  })

  it(`GET /media/:id/usage → ${expected.list === 200 ? 404 : 403}`, async () => {
    const response = await adminRequest(
      `/media/${missing}/usage`,
      await cookieFor(role)
    )
    expect(response.status).toBe(expected.list === 200 ? 404 : 403)
  })

  it(`POST /media → ${expected.upload}`, async () => {
    expect((await emptyForm("/media")).status).toBe(expected.upload)
  })

  it(`POST /media/:id/replace → ${expected.upload === 400 ? 400 : 403}`, async () => {
    expect((await emptyForm(`/media/${missing}/replace`)).status).toBe(
      expected.upload
    )
  })

  it(`PATCH /media/:id → ${expected.update}`, async () => {
    const response = await adminRequest(
      `/media/${missing}`,
      await cookieFor(role),
      { method: "PATCH", body: { alt: "A calm room" } }
    )
    expect(response.status).toBe(expected.update)
  })

  it(`DELETE /media/:id → ${expected.remove}`, async () => {
    const response = await adminRequest(
      `/media/${missing}`,
      await cookieFor(role),
      { method: "DELETE" }
    )
    expect(response.status).toBe(expected.remove)
  })
})
