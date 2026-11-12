import type { z } from "zod"

import type { Selection } from "@/blocks/fields"

// "all" keeps the collection's order; "chosen" keeps the editor's order.
export const select = <T extends { id: string }>(
  items: T[],
  selection: z.infer<typeof Selection>
) =>
  selection.mode === "all"
    ? items
    : selection.ids.flatMap((id) => items.filter((item) => item.id === id))

// The services.plans block has no selection: it shows the first four plans.
// Markup and rendering share this, so structured data never lists a plan the
// visitor cannot see.
export const PLAN_LIMIT = 4
export const visiblePlans = <T>(plans: T[]) => plans.slice(0, PLAN_LIMIT)

// A service's landing page link only counts when that page is live; otherwise
// the grid falls back to the block's own link.
export const withLivePagePaths = <T extends { pagePath: string }>(
  services: T[],
  live: string[]
): T[] =>
  services.map((s) => (live.includes(s.pagePath) ? s : { ...s, pagePath: "" }))
