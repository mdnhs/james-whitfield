// docs/brief.md §12.3. Anything else never reaches a page.
export const GTM_ID = /^GTM-[A-Z0-9]+$/
export const GA4_ID = /^G-[A-Z0-9]+$/
export const PIXEL_ID = /^\d{10,20}$/

export function validId(
  pattern: RegExp,
  value: string | null | undefined
): string | null {
  return value && pattern.test(value) ? value : null
}
