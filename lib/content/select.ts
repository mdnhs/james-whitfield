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
