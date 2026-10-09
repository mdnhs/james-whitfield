import type { NavLink } from "./nav-links"

export const FOOTER_BLURB =
  "Coach & Clinical Hypnotherapist. Supporting individuals, professionals, and forward-thinking organizations from the inside out."

export const LEGAL_LINKS: NavLink[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Disclaimer", href: "/disclaimer" },
]

// Seed input for the `footer` global. The Sitemap column appends the header
// links (source "navigation"), so a new page appears there on its own.
// Contact lines are placeholders from the design: replace before launch.
export const FOOTER = {
  blurb: FOOTER_BLURB,
  columns: [
    {
      title: "Sitemap",
      source: "navigation" as const,
      links: [{ label: "Home", href: "/" }],
    },
    {
      title: "Services",
      source: "links" as const,
      links: [
        { label: "Hypnotherapy", href: "/services" },
        { label: "Coaching", href: "/services" },
        { label: "Corporate", href: "/services#enterprise" },
      ],
    },
  ],
  contactLines: ["[email]", "[phone]", "[Dublin, Ireland]"],
  contactNote: "Online sessions available - Ireland, UK & USA.",
  legalLinks: LEGAL_LINKS,
  copyrightName: "Magda Kennedy",
}
