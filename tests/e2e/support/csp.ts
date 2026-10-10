import type { Page } from "@playwright/test"

export type Violation = {
  directive: string
  blocked: string
  source: string
  line: number
  sample: string
}

// Registered before any page script, so violations from the very first
// module evaluation are caught (Ruling R14).
export async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    const list: unknown[] = []
    ;(window as unknown as { __csp: unknown[] }).__csp = list
    document.addEventListener("securitypolicyviolation", (e) => {
      list.push({
        directive: e.effectiveDirective,
        blocked: e.blockedURI,
        source: e.sourceFile,
        line: e.lineNumber,
        sample: e.sample,
      })
    })
  })
}

export const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __csp: Violation[] }).__csp)
