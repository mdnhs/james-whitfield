import "server-only"

import { eq } from "drizzle-orm"

import { parseGlobal } from "@/lib/content/globals"
import { ogColors } from "@/lib/seo/og-theme"
import { checkTheme, describeIssue } from "@/lib/theme/checks"
import { presetAdminColours } from "@/lib/theme/admin"
import type { PresetId } from "@/lib/theme/presets"
import { ThemeConfig, type ThemeConfigValue } from "@/lib/theme/schema"
import { presetSiteTheme } from "@/lib/theme/site"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb, type DbLike } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"
import { invalidate, tags } from "@/server/lib/cache"
import { conflictError, topLevelDiff } from "@/server/lib/conflict"
import {
  findRevision,
  listRevisions,
  writeRevision,
} from "@/server/lib/revisions"

const KEY = "theme"
type Row = typeof settings.$inferSelect

const stored = (value: unknown) => parseGlobal(KEY, value)

function toDoc(row: Row | null) {
  const value = stored(row?.value)
  const hasDraft = row?.draft != null
  const draft = hasDraft ? stored(row!.draft) : value
  return {
    value,
    draft,
    hasDraft,
    version: row?.version ?? 0,
    updatedAt: row?.updatedAt ?? null,
    issues: checkTheme(draft),
  }
}
export type ThemeDoc = ReturnType<typeof toDoc>

async function findRow(db: DbLike, lock = false) {
  const query = db.select().from(settings).where(eq(settings.key, KEY)).limit(1)
  const [row] = lock ? await query.for("update") : await query
  return row ?? null
}

async function lockAt(db: DbLike, version: number) {
  const row = await findRow(db, true)
  if ((row?.version ?? 0) !== version)
    throw await conflictError(db, {
      version: row?.version ?? 0,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    })
  return row
}

async function write(
  db: DbLike,
  actor: Actor,
  before: Row | null,
  patch: { value?: ThemeConfigValue; draft: ThemeConfigValue | null }
) {
  const now = new Date()
  const [row] = before
    ? await db
        .update(settings)
        .set({
          ...patch,
          version: before.version + 1,
          updatedBy: actor.userId,
          updatedAt: now,
        })
        .where(eq(settings.key, KEY))
        .returning()
    : await db
        .insert(settings)
        .values({
          key: KEY,
          value: patch.value ?? stored({}),
          draft: patch.draft,
          version: 1,
          updatedBy: actor.userId,
        })
        .returning()
  return row!
}

const parseInput = (input: unknown) => {
  const parsed = ThemeConfig.safeParse(input ?? {})
  if (!parsed.success) throw invalid(parsed.error)
  return parsed.data
}

export async function getThemeAdmin() {
  return toDoc(await findRow(getDb()))
}

// R7: draft saves are not audited and expire nothing; draft-mode renders
// bypass the cache.
export async function saveThemeDraft(
  actor: Actor,
  input: { version: number; draft: unknown }
) {
  const draft = parseInput(input.draft)
  const row = await getDb().transaction(async (tx) => {
    const before = await lockAt(tx, input.version)
    return write(tx, actor, before, { draft })
  })
  return toDoc(row)
}

export async function publishTheme(actor: Actor, input: { version: number }) {
  const row = await getDb().transaction(async (tx) => {
    const before = await lockAt(tx, input.version)
    const next = stored(before?.draft ?? before?.value)
    const issues = checkTheme(next)
    if (issues.length)
      throw new ApiError(
        "VALIDATION_FAILED",
        `Some colours are too hard to read. ${issues.map(describeIssue).join(" ")}`,
        undefined,
        { issues }
      )
    const saved = await write(tx, actor, before, { value: next, draft: null })
    await writeRevision(tx, {
      entityType: "setting",
      entityId: KEY,
      version: saved.version,
      snapshot: next,
      createdBy: actor.userId,
      note: "Published theme",
    })
    await audit(
      actor,
      {
        action: "appearance.publish",
        entityType: "setting",
        entityId: KEY,
        summary: "Published the theme",
        diff: topLevelDiff(before?.value ?? null, next),
      },
      tx
    )
    return saved
  })
  invalidate([tags.setting(KEY)])
  return toDoc(row)
}

// R8: colours only; radius and mode stay.
export async function resetThemeDraft(
  actor: Actor,
  input: { version: number; preset: PresetId; scope: "site" | "admin" | "both" }
) {
  const row = await getDb().transaction(async (tx) => {
    const before = await lockAt(tx, input.version)
    const current = stored(before?.draft ?? before?.value)
    const draft: ThemeConfigValue = {
      site:
        input.scope === "admin" ? current.site : presetSiteTheme(input.preset),
      admin:
        input.scope === "site"
          ? current.admin
          : { ...current.admin, ...presetAdminColours(input.preset) },
    }
    const saved = await write(tx, actor, before, { draft })
    await audit(
      actor,
      {
        action: "appearance.reset",
        entityType: "setting",
        entityId: KEY,
        summary: `Reset the ${input.scope === "both" ? "theme" : input.scope + " theme"} draft to ${input.preset}`,
      },
      tx
    )
    return saved
  })
  return toDoc(row)
}

export async function discardThemeDraft(
  actor: Actor,
  input: { version: number }
) {
  const row = await getDb().transaction(async (tx) => {
    const before = await lockAt(tx, input.version)
    const saved = await write(tx, actor, before, { draft: null })
    await audit(
      actor,
      {
        action: "appearance.discard",
        entityType: "setting",
        entityId: KEY,
        summary: "Discarded the theme draft",
      },
      tx
    )
    return saved
  })
  return toDoc(row)
}

export const themeRevisions = async () =>
  (await listRevisions(getDb(), "setting", KEY)).items

export async function restoreThemeRevision(
  actor: Actor,
  revisionId: string,
  version: number
) {
  const revision = await findRevision(getDb(), "setting", KEY, revisionId)
  if (!revision) throw new ApiError("NOT_FOUND", "That version doesn't exist")
  // Re-validated: an old snapshot may predate a schema change.
  const draft = parseInput(revision.snapshot)
  const row = await getDb().transaction(async (tx) => {
    const before = await lockAt(tx, version)
    const saved = await write(tx, actor, before, { draft })
    await audit(
      actor,
      {
        action: "appearance.restore",
        entityType: "setting",
        entityId: KEY,
        summary: `Loaded theme version ${revision.version} into the draft`,
      },
      tx
    )
    return saved
  })
  return toDoc(row)
}

// R14: public colours for the admin's share-card preview.
export async function publishedColors() {
  return ogColors(stored((await findRow(getDb()))?.value).site)
}
