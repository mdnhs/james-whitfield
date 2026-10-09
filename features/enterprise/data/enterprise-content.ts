import { contactHref } from "@/lib/contact-href"

export const ENTERPRISE_CONTENT = {
  eyebrow: "Enterprise & Corporate",
  title: "For individuals now. Built to grow with your enterprise.",
  bullets: [
    "Workshops & group sessions",
    "Leadership coaching programmes",
    "Ongoing wellbeing support",
  ],
  cta: {
    label: "Enquire About Corporate Programmes →",
    href: contactHref({ topic: "workplace-wellbeing" }),
  },
  image: "/images/enterprise/enterprise-bg.png",
  tint: 0.9,
}
