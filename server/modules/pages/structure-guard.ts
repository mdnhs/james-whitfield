import "server-only"

import { sameStructure } from "@/blocks/structure"
import { ApiError } from "@/server/api/errors"

type HasBlocks = Parameters<typeof sameStructure>[0]

export function assertSameStructure(
  current: HasBlocks,
  next: HasBlocks,
  message = "Sections are fixed on this page"
): void {
  if (!sameStructure(current, next)) {
    throw new ApiError("VALIDATION_FAILED", message)
  }
}
