import { expect, test } from "@playwright/test"

import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.editor })

test("the first Tab reaches a visible skip link that jumps to the content", async ({
  page,
}) => {
  await page.goto("/admin")
  await page.keyboard.press("Tab")
  const skip = page.getByRole("link", { name: "Skip to content" })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
  await page.keyboard.press("Enter")
  await expect(page.locator("#main")).toBeFocused()
})

// The parts of a computed style a focus indicator can live in.
type Look = { boxShadow: string; outline: string; borderColor: string }

// Acceptance: full keyboard navigation, with visible focus everywhere. Each
// control's look while focused is compared with its look once focus has
// left, so an indicator counts only if focus is what draws it (a resting
// shadow or outline would otherwise pass for one).
test("every control in the shell is reachable and shows focus", async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== "admin-desktop",
    "the sheet has its own test"
  )
  await page.goto("/admin")
  const reached: { name: string; focused: Look }[] = []
  for (let step = 0; step < 40; step++) {
    await page.keyboard.press("Tab")
    const focused = await page.evaluate((index) => {
      const element = document.activeElement as HTMLElement | null
      if (!element || element === document.body) return null
      element.dataset.tabStop = String(index)
      const style = getComputedStyle(element)
      return {
        name: (
          element.getAttribute("aria-label") ??
          element.textContent ??
          ""
        ).trim(),
        focused: {
          boxShadow: style.boxShadow,
          outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
          borderColor: style.borderColor,
        },
      }
    }, step)
    if (!focused) break
    reached.push(focused)
  }

  // Move focus off every control, and the pointer off the page, before
  // reading their resting looks.
  await page.mouse.move(0, 0)
  await page.evaluate(() => (document.activeElement as HTMLElement).blur())
  const resting = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-tab-stop]")).map(
      (element) => {
        const style = getComputedStyle(element)
        return {
          index: Number(element.dataset.tabStop),
          look: {
            boxShadow: style.boxShadow,
            outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
            borderColor: style.borderColor,
          },
        }
      }
    )
  )
  const restingAt = new Map(resting.map(({ index, look }) => [index, look]))

  reached.forEach(({ name, focused }, index) => {
    const before = restingAt.get(index)
    expect(before, `${name} is still in the page`).toBeDefined()
    const ringed = focused.boxShadow !== before!.boxShadow
    const outlined =
      focused.outline !== before!.outline &&
      !/^none |\s0px /.test(focused.outline)
    expect(
      ringed || outlined,
      `${name} shows a focus indicator (focused ${JSON.stringify(focused)}, resting ${JSON.stringify(before)})`
    ).toBe(true)
  })

  expect(reached.map(({ name }) => name)).toEqual(
    expect.arrayContaining([
      "Skip to content",
      "Magda Kennedy admin home",
      "Dashboard",
      "Pages",
      "Log out",
      "Toggle navigation",
      "Search",
      "Notifications",
      "Account menu for Eddie Editor",
    ])
  )
})

test("the user menu works from the keyboard", async ({ page }) => {
  await page.goto("/admin")
  const trigger = page.getByRole("button", { name: /^Account menu for / })
  await trigger.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("menu")).toBeVisible()
  await expect(
    page.locator('[role="menuitem"]:focus, [role="menuitemradio"]:focus')
  ).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toBeHidden()
  await expect(trigger).toBeFocused()
})
