import "server-only"

import { and, asc, eq, isNotNull, isNull, ne } from "drizzle-orm"

import type { PageDocument } from "@/blocks/page"
import { serviceTemplate } from "@/blocks/service-template"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import { ctaBands, pages, services } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, REDIRECT_TAGS, tags } from "@/server/lib/cache"
import { insertPage, removePage } from "@/server/modules/pages/service"
import {
  recordPathChange,
  releasePath,
} from "@/server/modules/redirects/service"

// A service's detail page lives at /services/<slug> and follows the slug.
export const servicePagePath = (slug: string) => `/services/${slug}`

const pathTaken = () =>
  new ApiError("CONFLICT", "A page already lives at that address", {
    path: ["A page already lives at that address"],
  })

async function linkedPage(db: DbLike, serviceId: string) {
  const [row] = await db
    .select({ id: pages.id, path: pages.path, status: pages.status })
    .from(pages)
    .where(eq(pages.serviceId, serviceId))
    .limit(1)
  return row ?? null
}

// The template's hero image is the Services page's hero image.
async function servicesHeroImage(db: DbLike) {
  const [row] = await db
    .select({ draft: pages.draft, published: pages.published })
    .from(pages)
    .where(eq(pages.systemKey, "services"))
    .limit(1)
  const doc: PageDocument | null | undefined = row?.published ?? row?.draft
  const hero = doc?.blocks.find((b) => b.type === "hero.page")
  const mediaId =
    hero?.type === "hero.page" ? hero.data.image?.mediaId : undefined
  if (!mediaId) {
    throw new ApiError("CONFLICT", "Give the Services page a hero image first")
  }
  return mediaId
}

export async function enableServicePage(actor: Actor, serviceId: string) {
  const result = await getDb().transaction(async (tx) => {
    const [service] = await tx
      .select()
      .from(services)
      .where(eq(services.id, serviceId))
      .for("update")
      .limit(1)
    if (!service) throw new ApiError("NOT_FOUND", "That service doesn't exist")
    // Only a page linked by service_id counts as this service's page. A
    // page_path naming anything else (a system page, another service's
    // page, nothing at all) is stale and is overwritten below.
    if (await linkedPage(tx, serviceId)) {
      throw new ApiError("CONFLICT", "This service already has a details page")
    }
    const [band] = await tx
      .select({ id: ctaBands.id })
      .from(ctaBands)
      .where(eq(ctaBands.isVisible, true))
      .orderBy(asc(ctaBands.sort))
      .limit(1)
    if (!band) {
      throw new ApiError("CONFLICT", "Add a call-to-action band first")
    }
    const heroImageId = await servicesHeroImage(tx)
    const path = servicePagePath(service.slug)
    const page = await insertPage(tx, {
      path,
      title: service.title,
      // Live at once with placeholder copy for the editor to rewrite.
      document: serviceTemplate(service, band.id, heroImageId),
      serviceId,
      publish: true,
      actor,
    })
    await tx
      .update(services)
      .set({ pagePath: path })
      .where(eq(services.id, serviceId))
    // An old redirect away from this address would hide the new page.
    const released = await releasePath(tx, path)
    return { pageId: page.id, path, released }
  })
  invalidate([
    tags.page(result.pageId),
    tags.routes,
    tags.collection("services"),
    ...(result.released ? REDIRECT_TAGS : []),
  ])
  return { pageId: result.pageId, path: result.path }
}

// Every service has a details page: this makes the ones that are missing
// (services added before pages existed, or a create whose page failed).
// Idempotent; a service whose page can't be made yet is reported, not thrown.
export async function ensureServicePages(actor: Actor): Promise<{
  created: number
  failed: { serviceId: string; message: string }[]
}> {
  const missing = await getDb()
    .select({ id: services.id })
    .from(services)
    .leftJoin(pages, eq(pages.serviceId, services.id))
    .where(isNull(pages.id))
    .orderBy(asc(services.sort))
  let created = 0
  const failed: { serviceId: string; message: string }[] = []
  for (const { id } of missing) {
    try {
      await enableServicePage(actor, id)
      created++
    } catch (error) {
      if (!(error instanceof ApiError)) throw error
      // Made meanwhile by another request: nothing to report.
      if (error.message === "This service already has a details page") continue
      failed.push({ serviceId: id, message: error.message })
    }
  }
  return { created, failed }
}

export async function disableServicePage(actor: Actor, serviceId: string) {
  const result = await getDb().transaction(async (tx) => {
    const [service] = await tx
      .select({ id: services.id })
      .from(services)
      .where(eq(services.id, serviceId))
      .for("update")
      .limit(1)
    if (!service) throw new ApiError("NOT_FOUND", "That service doesn't exist")
    const page = await linkedPage(tx, serviceId)
    if (!page) throw new ApiError("NOT_FOUND", "This service has no page")
    const redirectsChanged = await removePage(tx, actor, page)
    await tx
      .update(services)
      .set({ pagePath: "" })
      .where(eq(services.id, serviceId))
    return { pageId: page.id, redirectsChanged }
  })
  invalidate([
    tags.page(result.pageId),
    tags.routes,
    tags.collection("services"),
    ...(result.redirectsChanged ? REDIRECT_TAGS : []),
  ])
}

type ServiceRow = { id: string; slug: string; isVisible: boolean }

// The fields the hook reads, from a services row typed generically.
export const serviceRow = (row: Record<string, unknown>): ServiceRow => ({
  id: String(row.id),
  slug: String(row.slug),
  isVisible: row.isVisible === true,
})

export type DetailPage = {
  id: string
  path: string
  status: "draft" | "published"
  updatedAt: Date
}

// Each service's linked detail page, for the admin list's switch.
export async function detailPagesByService(db: DbLike = getDb()) {
  const rows = await db
    .select({
      serviceId: pages.serviceId,
      id: pages.id,
      path: pages.path,
      status: pages.status,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .where(isNotNull(pages.serviceId))
  return new Map<string, DetailPage>(
    rows.map(({ serviceId, ...page }) => [serviceId!, page])
  )
}

// Runs in the services update transaction: a new slug moves the page (a
// published one leaves a redirect behind) and a visibility change expires
// it. Returns the tags to expire after commit.
export async function syncServicePage(
  tx: DbLike,
  actor: Actor,
  before: ServiceRow,
  after: ServiceRow
): Promise<string[]> {
  const page = await linkedPage(tx, after.id)
  if (!page) return []
  const expire: string[] = []
  if (before.isVisible !== after.isVisible) {
    expire.push(tags.page(page.id), tags.routes)
  }
  // Only a page at /services/<old slug> follows the slug; a linked page
  // elsewhere (a legacy /team, say) keeps its address.
  if (before.slug === after.slug || page.path !== servicePagePath(before.slug))
    return expire
  const path = servicePagePath(after.slug)
  const [taken] = await tx
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.path, path), ne(pages.id, page.id)))
    .limit(1)
  if (taken) throw pathTaken()
  await tx
    .update(pages)
    .set({ path, updatedBy: actor.userId })
    .where(eq(pages.id, page.id))
  await tx
    .update(services)
    .set({ pagePath: path })
    .where(eq(services.id, after.id))
  if (page.status === "published") {
    await recordPathChange(tx, {
      from: page.path,
      to: path,
      pageId: page.id,
      note: "Automatic: the service's slug changed",
      createdBy: actor.userId,
    })
    expire.push(...REDIRECT_TAGS)
  }
  await audit(
    actor,
    {
      action: "page.path",
      entityType: "page",
      entityId: page.id,
      summary: `Moved ${page.path} to ${path}`,
      diff: { path: { from: page.path, to: path } },
    },
    tx
  )
  expire.push(tags.page(page.id), tags.routes)
  return expire
}

// Runs in the services delete transaction, before the row goes: the page
// would otherwise outlive it (the foreign key only sets null).
export async function removeServicePage(
  tx: DbLike,
  actor: Actor,
  serviceId: string
): Promise<string[]> {
  const page = await linkedPage(tx, serviceId)
  if (!page) return []
  const redirectsChanged = await removePage(tx, actor, page)
  return [
    tags.page(page.id),
    tags.routes,
    ...(redirectsChanged ? REDIRECT_TAGS : []),
  ]
}
