import { NAV_LINKS, type NavLink } from "@/features/navbar"

export const FOOTER_BLURB =
  "Coach & Clinical Hypnotherapist. Supporting individuals, professionals, and forward-thinking organizations from the inside out."

export const FOOTER_COLUMNS: { title: string; links: NavLink[] }[] = [
  { title: "Sitemap", links: [{ label: "Home", href: "/" }, ...NAV_LINKS] },
  {
    title: "Services",
    links: [
      { label: "Hypnotherapy", href: "/services" },
      { label: "Coaching", href: "/services" },
      { label: "Corporate", href: "/services#enterprise" },
    ],
  },
]

// Placeholders from the design — replace with real details before launch.
export const FOOTER_CONTACT = {
  lines: ["[email]", "[phone]", "[Dublin, Ireland]"],
  note: "Online sessions available - Ireland, UK & USA.",
}

export const LEGAL_LINKS: NavLink[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Disclaimer", href: "/disclaimer" },
]
