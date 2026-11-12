import { expect, it } from "vitest"

import {
  chatDetailQuery,
  chatListQuery,
  chatUnreadQuery,
  pollInterval,
} from "./queries"

const ID = "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc"

it("polls every 4 s in view and every 30 s when hidden", () => {
  expect(pollInterval(true)).toBe(4_000)
  expect(pollInterval(false)).toBe(30_000)
  expect(chatListQuery("open", false).refetchInterval).toBe(30_000)
  expect(chatDetailQuery(ID, false).refetchInterval).toBe(30_000)
  expect(chatListQuery("open", true).refetchInterval).toBe(4_000)
})

it("keeps polling in a background tab", () => {
  expect(chatListQuery("open", false).refetchIntervalInBackground).toBe(true)
  expect(chatDetailQuery(ID, false).refetchIntervalInBackground).toBe(true)
  expect(chatUnreadQuery(true).refetchIntervalInBackground).toBe(true)
  expect(chatUnreadQuery(true).refetchInterval).toBe(30_000)
})
