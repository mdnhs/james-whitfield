export type NavLink = {
  label: string
  href: string
}

export const NAV_LINKS: NavLink[] = [
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Insights", href: "/insights" },
  { label: "Contact", href: "/contact" },
]

// Seed input for the `navigation` global.
export const NAVIGATION = {
  links: NAV_LINKS,
  cta: { label: "Book a Call", href: "/contact" },
}
