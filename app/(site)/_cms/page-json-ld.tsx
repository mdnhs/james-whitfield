import { io } from "next/cache"
import type { Thing } from "schema-dts"

import { JsonLd } from "@/components/json-ld"
import { isServicePagePath } from "@/lib/content/page-path"
import { select, visiblePlans } from "@/lib/content/select"
import type { PublishedPage } from "@/lib/content/types"
import {
  breadcrumbNode,
  businessNode,
  faqNode,
  graph,
  personNode,
  planNodes,
  serviceFormatNodes,
  url,
  websiteNode,
} from "@/lib/seo/json-ld"
import { getEnv } from "@/server/env"
import {
  getFaqs,
  getMedia,
  getPlans,
  getPublishedPage,
  getServices,
  getSetting,
} from "@/server/modules/content/queries"

export async function PageJsonLd({ page }: { page: PublishedPage }) {
  await io()
  const origin = getEnv().SITE_URL.replace(/\/$/, "")
  const [site, contact, seo, copy] = await Promise.all([
    getSetting("site"),
    getSetting("contact"),
    getSetting("seo"),
    getSetting("microcopy"),
  ])
  const visible = page.document.blocks.filter((b) => !b.hidden)
  if (page.systemKey === "home") {
    const refs = [site.logo, contact.clinic.photo, site.portrait]
    const ids = refs.flatMap((r) => (r ? [r.mediaId] : []))
    const [assets, services] = await Promise.all([
      ids.length ? getMedia(ids) : Promise.resolve(new Map()),
      getServices(),
    ])
    const src = (r: (typeof refs)[number]) => {
      const asset = r ? assets.get(r.mediaId) : null
      return asset ? url(origin, asset.src) : undefined
    }
    const [logo, clinicPhoto, portrait] = refs.map(src)
    return (
      <JsonLd
        graph={graph([
          websiteNode({ origin, siteName: site.name }),
          businessNode({
            origin,
            site,
            contact,
            seo,
            logo,
            image: clinicPhoto ? [clinicPhoto] : undefined,
          }),
          personNode({
            origin,
            site,
            image: portrait,
            knowsAbout: services.map((s) => s.title),
          }),
        ])}
      />
    )
  }
  const heroTitle = (p: PublishedPage) => {
    const hero = p.document.blocks.find(
      (b) => !b.hidden && b.type === "hero.page"
    )
    return hero?.type === "hero.page" ? hero.data.title : p.title
  }
  const crumbs = [{ name: copy.breadcrumbHome || "Home", path: "/" }]
  if (isServicePagePath(page.path)) {
    const services = await getPublishedPage("/services")
    if (services) {
      crumbs.push({ name: heroTitle(services), path: "/services" })
    }
  }
  crumbs.push({ name: heroTitle(page), path: page.path })
  const nodes: Thing[] = [breadcrumbNode(origin, crumbs)]
  const faq = visible.find((b) => b.type === "faq")
  if (faq?.type === "faq") {
    const node = faqNode(select(await getFaqs(), faq.data.selection))
    if (node) nodes.push(node)
  }
  const serviceFaq = visible.find((b) => b.type === "service.faq")
  if (serviceFaq?.type === "service.faq") {
    const node = faqNode(serviceFaq.data.items)
    if (node) nodes.push(node)
  }
  const formats = visible.find((b) => b.type === "service.formats")
  if (formats?.type === "service.formats") {
    nodes.push(
      ...serviceFormatNodes({
        origin,
        path: page.path,
        plans: formats.data.plans,
        siteName: site.name,
      })
    )
  }
  if (visible.some((b) => b.type === "services.plans")) {
    nodes.push(
      ...planNodes({
        origin,
        plans: visiblePlans(await getPlans()),
        siteName: site.name,
      })
    )
  }
  return <JsonLd graph={graph(nodes)} />
}
