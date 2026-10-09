import { expect, test } from "@playwright/test"

// Review Focus #2: the first paint must already be in the right theme, and
// React must not report a hydration mismatch on <html>.
test("a dark system preference paints dark before hydration", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const probe = window as unknown as Record<string, string>
      probe.__themeAtDomReady = document.documentElement.className
      probe.__bodyAtDomReady = getComputedStyle(document.body).backgroundColor
    })
  })
  const errors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })

  await page.goto("/admin/sign-in")

  const probe = await page.evaluate(() => {
    const w = window as unknown as Record<string, string>
    return { theme: w.__themeAtDomReady, body: w.__bodyAtDomReady }
  })
  expect(probe.theme).toMatch(/\bdark\b/)
  expect(probe.body).toBe("rgb(12, 16, 13)")
  await expect(page.locator("html")).toHaveClass(/\bdark\b/)
  expect(errors.filter((text) => /hydrat/i.test(text))).toEqual([])
})

test("a saved light choice wins over a dark system preference", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.addInitScript(() =>
    localStorage.setItem("mk-admin-theme", "light")
  )
  await page.goto("/admin/sign-in")
  await expect(page.locator("html")).toHaveClass(/\blight\b/)
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
})

test("the public site stays light under a dark preference", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
})
