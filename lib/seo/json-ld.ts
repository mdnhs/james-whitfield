import type {
  BlogPosting,
  BreadcrumbList,
  FAQPage,
  Graph,
  LocalBusiness,
  Person,
  ProfessionalService,
  Service,
  Thing,
  WebSite,
} from "schema-dts"

import type { GlobalValue } from "@/lib/content/globals"
import type { ArticleDetail, FaqView, PlanView } from "@/lib/content/types"

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const
const abs = (origin: string, path: string) =>
  path === "/" ? origin : `${origin}${path}`
const url = (origin: string, src: string) =>
  /^https?:\/\//.test(src) ? src : abs(origin, src)

// docs/brief.md §11 / §15: < > & and the line separators are escaped, so no
// string can end the script element; the result is still valid JSON.
const ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
}
export function jsonLd(value: Graph) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => ESCAPES[c]!)
}

export const graph = (nodes: Thing[]): Graph => ({
  "@context": "https://schema.org",
  "@graph": nodes,
})

export function websiteNode({
  origin,
  siteName,
}: {
  origin: string
  siteName: string
}): WebSite {
  return {
    "@type": "WebSite",
    name: siteName,
    url: origin,
    inLanguage: "en-IE",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/insights?q={search_term_string}`,
      },
      // schema-dts has no key for this Google extension; keep the cast local.
      ...({ "query-input": "required name=search_term_string" } as object),
    },
  }
}

export function businessNode(i: {
  origin: string
  site: GlobalValue<"site">
  contact: GlobalValue<"contact">
  seo: GlobalValue<"seo">
}): ProfessionalService | LocalBusiness {
  const { address, phone, hours, clinic } = i.contact
  const sameAs = [...i.seo.business.sameAs, ...i.site.social.map((s) => s.url)]
  return {
    "@type": i.seo.business.type,
    name: i.site.name,
    ...(i.site.legalName ? { legalName: i.site.legalName } : {}),
    url: i.origin,
    ...(phone.e164 ? { telephone: phone.e164 } : {}),
    ...(i.contact.email ? { email: i.contact.email } : {}),
    ...(i.seo.business.priceRange
      ? { priceRange: i.seo.business.priceRange }
      : {}),
    areaServed: ["IE", "GB", "US"],
    ...(sameAs.length ? { sameAs } : {}),
    ...(address.city || address.lines.length
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: address.lines.join(", "),
            addressLocality: address.city,
            postalCode: address.eircode,
            addressCountry: address.country,
          },
        }
      : {}),
    ...(clinic.geo
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: clinic.geo.lat,
            longitude: clinic.geo.lng,
          },
        }
      : {}),
    ...(hours.weekly.length
      ? {
          openingHoursSpecification: hours.weekly.map((h) => ({
            "@type": "OpeningHoursSpecification" as const,
            dayOfWeek: h.days.map((d) => DAYS[d - 1]!),
            opens: h.opens,
            closes: h.closes,
          })),
        }
      : {}),
  } as ProfessionalService
}

export function personNode({
  origin,
  site,
}: {
  origin: string
  site: GlobalValue<"site">
}): Person {
  return {
    "@type": "Person",
    name: site.name,
    ...(site.professionalTitle ? { jobTitle: site.professionalTitle } : {}),
    url: `${origin}/about`,
    ...(site.social.length ? { sameAs: site.social.map((s) => s.url) } : {}),
  }
}

export function breadcrumbNode(
  origin: string,
  trail: { name: string; path: string }[]
): BreadcrumbList {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: abs(origin, step.path),
    })),
  }
}

export function faqNode(items: FaqView[]): FAQPage {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  }
}

export function planNodes(i: {
  origin: string
  plans: PlanView[]
  siteName: string
}): Service[] {
  return i.plans.map((p) => ({
    "@type": "Service",
    name: p.name,
    description: p.summary,
    provider: {
      "@type": "ProfessionalService",
      name: i.siteName,
      url: i.origin,
    },
    ...(p.priceCents !== null
      ? {
          offers: {
            "@type": "Offer",
            price: (p.priceCents / 100).toFixed(2),
            priceCurrency: "EUR",
            url: `${i.origin}/contact?plan=${p.slug}`,
          },
        }
      : {}),
  }))
}

export function blogPostingNode(i: {
  origin: string
  article: ArticleDetail
  siteName: string
}): BlogPosting {
  const a = i.article
  return {
    "@type": "BlogPosting",
    headline: a.title.slice(0, 110),
    description: a.excerpt,
    image: [url(i.origin, a.image.src)],
    datePublished: a.date.iso,
    dateModified: a.updatedAt,
    author: {
      "@type": "Person",
      name: a.author.name,
      url: `${i.origin}/about`,
    },
    publisher: { "@type": "Organization", name: i.siteName, url: i.origin },
    mainEntityOfPage: `${i.origin}/insights/${a.slug}`,
    articleSection: a.category.name,
    inLanguage: "en-IE",
  }
}
