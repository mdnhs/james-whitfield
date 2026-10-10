import type { TrackEvent } from "./events"

// Delegated click tracking. Activity-safe: hidden routes cannot be clicked,
// and nothing here queries the document for page content.
export function clickEvent(target: Element | null): TrackEvent | null {
  const book = target?.closest<HTMLElement>('[data-track="book_appointment"]')
  if (book)
    return {
      event: "book_appointment",
      params: { cta_location: book.dataset.ctaLocation || "unknown" },
    }
  const href = target?.closest("a[href]")?.getAttribute("href") ?? ""
  if (href.startsWith("tel:"))
    return { event: "contact_click", params: { method: "phone" } }
  if (href.startsWith("mailto:"))
    return { event: "contact_click", params: { method: "email" } }
  return null
}
