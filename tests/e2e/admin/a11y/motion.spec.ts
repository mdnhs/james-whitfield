import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor, reducedMotion: "reduce" })

// docs/brief.md §9.2: motion is restrained and reduced-motion is respected.
test("a reduced-motion preference switches transitions off", async ({
  page,
}) => {
  await page.goto("/admin")
  const pill = page.getByRole("button", { name: "Search", exact: true })
  const duration = await pill.evaluate(
    (element) => getComputedStyle(element).transitionDuration
  )
  expect(parseFloat(duration)).toBeLessThan(0.001)
})
