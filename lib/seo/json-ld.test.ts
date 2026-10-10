import { describe, expect, it } from "vitest"

import { GLOBALS } from "@/lib/content/globals"

import {
  blogPostingNode,
  breadcrumbNode,
  businessNode,
  faqNode,
  graph,
  jsonLd,
  personNode,
  planNodes,
  websiteNode,
} from "./json-ld"

const origin = "https://magdakennedy.ie"
const site = GLOBALS.site.parse({
  name: "Magda Kennedy",
  legalName: "Magda Kennedy Hypnotherapy",
  professionalTitle: "Clinical Hypnotherapist",
  social: [{ label: "LinkedIn", url: "https://linkedin.com/in/magda" }],
})
const contact = GLOBALS.contact.parse({
  email: "hello@example.com",
  phone: { display: "01 234 5678", e164: "+35312345678" },
  address: {
    lines: ["1 Main St"],
    city: "Dublin",
    eircode: "D02 XY45",
    country: "Ireland",
  },
  hours: { weekly: [{ days: [1, 2, 3], opens: "09:00", closes: "17:00" }] },
  clinic: { geo: { lat: 53.34, lng: -6.26 } },
})
const seo = GLOBALS.seo.parse({
  business: {
    type: "ProfessionalService",
    priceRange: "€€",
    sameAs: ["https://facebook.com/magda"],
  },
})

describe("jsonLd", () => {
  it("escapes < so a title cannot close the script (Review Focus 5)", () => {
    const title = "</script><script>alert(1)</script>"
    const out = jsonLd(graph([{ "@type": "Thing", name: title }]))
    expect(out).not.toContain("<")
    expect(out).toContain("\\u003c/script\\u003e")
    expect(JSON.parse(out)["@graph"][0].name).toBe(title)
  })
})

describe("site nodes", () => {
  it("adds a SearchAction for /insights?q=", () => {
    expect(websiteNode({ origin, siteName: "Magda Kennedy" })).toMatchObject({
      "@type": "WebSite",
      url: origin,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${origin}/insights?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    })
  })

  it("describes the practice with address, geo, hours, phone and reach", () => {
    expect(businessNode({ origin, site, contact, seo })).toMatchObject({
      "@type": "ProfessionalService",
      name: "Magda Kennedy",
      url: origin,
      telephone: "+35312345678",
      email: "hello@example.com",
      priceRange: "€€",
      areaServed: ["IE", "GB", "US"],
      sameAs: ["https://facebook.com/magda", "https://linkedin.com/in/magda"],
      address: {
        "@type": "PostalAddress",
        streetAddress: "1 Main St",
        addressLocality: "Dublin",
        postalCode: "D02 XY45",
        addressCountry: "Ireland",
      },
      geo: { "@type": "GeoCoordinates", latitude: 53.34, longitude: -6.26 },
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday"],
          opens: "09:00",
          closes: "17:00",
        },
      ],
    })
  })

  it("omits empty optional fields", () => {
    const bare = businessNode({
      origin,
      site,
      contact: GLOBALS.contact.parse({}),
      seo: GLOBALS.seo.parse({}),
    })
    expect(bare).not.toHaveProperty("telephone")
    expect(bare).not.toHaveProperty("geo")
    expect(bare).not.toHaveProperty("openingHoursSpecification")
  })

  it("names the person", () => {
    expect(personNode({ origin, site })).toMatchObject({
      "@type": "Person",
      name: "Magda Kennedy",
      jobTitle: "Clinical Hypnotherapist",
      url: `${origin}/about`,
    })
  })
})

describe("page nodes", () => {
  it("builds absolute breadcrumbs", () => {
    expect(
      breadcrumbNode(origin, [
        { name: "Home", path: "/" },
        { name: "About", path: "/about" },
      ])
    ).toEqual({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: origin },
        {
          "@type": "ListItem",
          position: 2,
          name: "About",
          item: `${origin}/about`,
        },
      ],
    })
  })

  it("marks up FAQs and plans", () => {
    expect(
      faqNode([{ id: "1", question: "Does it work?", answer: "Often." }])
    ).toEqual({
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Does it work?",
          acceptedAnswer: { "@type": "Answer", text: "Often." },
        },
      ],
    })
    const [service] = planNodes({
      origin,
      siteName: "Magda Kennedy",
      plans: [
        {
          id: "p",
          slug: "programme",
          name: "Programme",
          priceLabel: "€840",
          priceCents: 84000,
          unit: "4 sessions",
          summary: "Four sessions.",
          features: [],
          ctaLabel: "Book",
          featured: false,
        },
      ],
    })
    expect(service).toMatchObject({
      "@type": "Service",
      name: "Programme",
      description: "Four sessions.",
      provider: {
        "@type": "ProfessionalService",
        name: "Magda Kennedy",
        url: origin,
      },
      offers: {
        "@type": "Offer",
        price: "840.00",
        priceCurrency: "EUR",
        url: `${origin}/contact?plan=programme`,
      },
    })
  })
})

describe("blogPostingNode", () => {
  it("carries Google's required BlogPosting properties", () => {
    const node = blogPostingNode({
      origin,
      siteName: "Magda Kennedy",
      article: {
        slug: "calm",
        title: "Calm is a skill",
        excerpt: "An excerpt.",
        image: { src: "/uploads/cover.jpg" },
        author: { name: "Magda Kennedy" },
        category: { name: "Anxiety" },
        date: { iso: "2026-01-02T00:00:00.000Z" },
        updatedAt: "2026-01-03T00:00:00.000Z",
      } as never,
    })
    expect(node).toMatchObject({
      "@type": "BlogPosting",
      headline: "Calm is a skill",
      description: "An excerpt.",
      image: [`${origin}/uploads/cover.jpg`],
      datePublished: "2026-01-02T00:00:00.000Z",
      dateModified: "2026-01-03T00:00:00.000Z",
      author: {
        "@type": "Person",
        name: "Magda Kennedy",
        url: `${origin}/about`,
      },
      publisher: { "@type": "Organization", name: "Magda Kennedy" },
      mainEntityOfPage: `${origin}/insights/calm`,
      articleSection: "Anxiety",
    })
  })
})
