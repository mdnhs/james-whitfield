import "server-only"

import type { CheckId } from "@/lib/seo/checks"
import type { SeoHealth } from "@/server/modules/seo/health"

export type ContentGauge = {
  complete: number
  needsWork: number
  missing: number
  total: number
}

// Ruling R4: "missing SEO or alt" (docs/brief.md §9.3) is a missing
// description, share image or alt text; any other failing check is work.
const MISSING: ReadonlySet<CheckId> = new Set([
  "description",
  "og-image",
  "alt-text",
])

export function contentGauge(
  health: Pick<SeoHealth, "issues">,
  entities: readonly { kind: "page" | "article"; id: string }[]
): ContentGauge {
  const worst = new Map<string, "missing" | "work">()
  for (const issue of health.issues) {
    if (issue.kind === "media") continue
    const key = `${issue.kind}:${issue.id}`
    if (MISSING.has(issue.check)) worst.set(key, "missing")
    else if (!worst.has(key)) worst.set(key, "work")
  }
  let missing = 0
  let needsWork = 0
  for (const e of entities) {
    const state = worst.get(`${e.kind}:${e.id}`)
    if (state === "missing") missing += 1
    else if (state === "work") needsWork += 1
  }
  return {
    complete: entities.length - missing - needsWork,
    needsWork,
    missing,
    total: entities.length,
  }
}
