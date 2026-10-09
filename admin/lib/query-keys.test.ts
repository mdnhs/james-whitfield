import { expect, it } from "vitest"

import { queryKeys } from "./query-keys"

it("normalises search terms so equal searches share a cache entry", () => {
  expect(queryKeys.search("  Users ")).toEqual(queryKeys.search("users"))
})

it("nests every audit key under one prefix for invalidation", () => {
  const list = queryKeys.audit.list({ page: 2, pageSize: 20, action: "x" })
  expect(list.slice(0, 1)).toEqual([...queryKeys.audit.all])
  expect(list).not.toEqual(queryKeys.audit.list({ page: 1, pageSize: 20 }))
})
