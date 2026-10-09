import { expect, it } from "vitest"

import { formatBadge } from "./format-badge"

it.each([
  [3, "3"],
  [99, "99"],
  [120, "99+"],
])("formatBadge(%i) is %j", (count, expected) => {
  expect(formatBadge(count)).toBe(expected)
})
