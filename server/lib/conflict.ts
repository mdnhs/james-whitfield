import "server-only"

import { eq } from "drizzle-orm"

import { ApiError } from "@/server/api/errors"
import type { DbLike } from "@/server/db/client"
import { users } from "@/server/db/schema"

export async function userName(db: DbLike, id: string | null) {
  if (!id) return null
  const [row] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  return row?.name ?? null
}

// docs/brief.md §6.5: a stale version gets 409 with the current state, so
// the UI can offer "review / overwrite".
export async function conflictError(
  db: DbLike,
  current: { version: number; updatedAt: Date | null; updatedBy: string | null }
) {
  return new ApiError(
    "CONFLICT",
    "Someone else changed this after you opened it",
    undefined,
    {
      current: {
        version: current.version,
        updatedAt: current.updatedAt?.toISOString() ?? null,
        updatedBy: await userName(db, current.updatedBy),
      },
    }
  )
}

// Postgres 23505, possibly wrapped by the driver or Drizzle.
export function isUniqueViolation(error: unknown): boolean {
  for (
    let e: unknown = error, i = 0;
    e && i < 5;
    i++, e = (e as { cause?: unknown }).cause
  ) {
    if ((e as { code?: unknown }).code === "23505") return true
  }
  return false
}

// Audit diffs at the first level: enough to see what moved, small enough
// to keep in the log.
export function topLevelDiff(before: unknown, after: unknown) {
  const a = (before ?? {}) as Record<string, unknown>
  const b = (after ?? {}) as Record<string, unknown>
  const diff: Record<string, { from: unknown; to: unknown }> = {}
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      diff[key] = { from: a[key] ?? null, to: b[key] ?? null }
    }
  }
  return diff
}
