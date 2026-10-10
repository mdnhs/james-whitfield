import "server-only"

import { eq, inArray } from "drizzle-orm"

import { COLLECTION_LABELS, COLLECTION_NAMES } from "@/lib/content/collections"
import {
  GLOBAL_LABELS,
  type EditableGlobalKey,
  type SettingsPage,
} from "@/lib/content/global-access"
import {
  LEGAL_PATHS,
  legalFinding,
  scanContent,
  type QaFinding,
  type QaSource,
} from "@/lib/content/qa"
import { getDb, type DbLike } from "@/server/db/client"
import { pages, settings } from "@/server/db/schema"
import { entryFor, titleOf } from "@/server/modules/collections/registry"
import { listLiveEntities } from "@/server/modules/seo/live"

// The globals a visitor reads (Ruling R5). SEO, consent, scripts,
// notifications and privacy hold settings, not site copy.
const QA_GLOBALS = {
  site: "identity",
  contact: "contact",
  navigation: "navigation",
  footer: "footer",
  newsletter: "forms",
  contactForm: "forms",
  microcopy: "forms",
} as const satisfies Partial<Record<EditableGlobalKey, SettingsPage>>
type QaGlobal = keyof typeof QA_GLOBALS

async function loadSources(db: DbLike): Promise<QaSource[]> {
  const [live, globalRows, collectionRows] = await Promise.all([
    listLiveEntities(db),
    db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(inArray(settings.key, Object.keys(QA_GLOBALS))),
    Promise.all(
      COLLECTION_NAMES.map((name) => {
        const { table } = entryFor(name)
        return db.select().from(table).where(eq(table.isVisible, true))
      })
    ),
  ])
  return [
    ...live.map((e) => ({
      label: `${e.kind === "page" ? "Page" : "Article"} “${e.title}”`,
      href:
        e.kind === "page" ? `/admin/pages/${e.id}` : `/admin/insights/${e.id}`,
      value: e.kind === "page" ? e.document : e.body,
    })),
    ...globalRows.map((row) => ({
      label: GLOBAL_LABELS[row.key as QaGlobal],
      href: `/admin/settings/${QA_GLOBALS[row.key as QaGlobal]}`,
      value: row.value,
    })),
    ...COLLECTION_NAMES.flatMap((name, index) =>
      collectionRows[index]!.map((row) => ({
        label: `${COLLECTION_LABELS[name]}: ${titleOf(name, row as Record<string, unknown>)}`,
        href: `/admin/collections/${name}`,
        value: row,
      }))
    ),
  ]
}

async function legalFindings(db: DbLike): Promise<QaFinding[]> {
  const rows = await db
    .select({
      id: pages.id,
      path: pages.path,
      title: pages.title,
      status: pages.status,
    })
    .from(pages)
    .where(inArray(pages.path, [...LEGAL_PATHS]))
  return LEGAL_PATHS.flatMap((path) => {
    const row = rows.find((r) => r.path === path)
    return row?.status === "published" ? [] : [legalFinding(path, row ?? null)]
  })
}

export async function getContentFindings(
  db: DbLike = getDb()
): Promise<QaFinding[]> {
  const [sources, legal] = await Promise.all([
    loadSources(db),
    legalFindings(db),
  ])
  return [...scanContent(sources), ...legal]
}
