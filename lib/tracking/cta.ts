// Markup contract for booking CTAs (read by lib/tracking/clicks.ts): only
// links to the contact page are booking CTAs.
export function ctaTrackAttrs(href: string, location: string) {
  return href.startsWith("/contact")
    ? ({
        "data-track": "book_appointment",
        "data-cta-location": location,
      } as const)
    : {}
}
