import { expect, it } from "vitest"

import { initials } from "./initials"

it.each([
  ["Olive Owner", "OO"],
  ["eddie", "E"],
  ["  Mary  Ann  Byrne ", "MA"],
  ["", "?"],
])("initials(%j) is %j", (name, expected) => {
  expect(initials(name)).toBe(expected)
})
