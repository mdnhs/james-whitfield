import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

import { PARITY_ROUTES } from "../parity/routes"
import { settle } from "../support/settle"

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

test.use({ reducedMotion: "reduce" })

// docs/brief.md §16 Quality row: axe in Playwright on the public site.
for (const route of [
  ...PARITY_ROUTES,
  { name: "not-found", path: "/no-such-page" },
]) {
  test(`axe: ${route.name} has no serious or critical violations`, async ({
    page,
  }) => {
    await page.goto(route.path)
    await settle(page)
    const { violations } = await new AxeBuilder({ page })
      .withTags(TAGS)
      .analyze()
    expect(
      violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`
        )
    ).toEqual([])
  })
}
