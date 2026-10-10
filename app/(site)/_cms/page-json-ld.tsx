import { io } from "next/cache"
import type { Thing } from "schema-dts"

import { JsonLd } from "@/components/json-ld"
import { select } from "@/lib/content/select"
import type { PublishedPage } from "@/lib/content/types"
import {
  breadcrumbNode,
  businessNode,
  faqNode,
  graph,
  personNode,
  planNodes,
  websiteNode,
} from "@/lib/seo/json-ld"
import { getEnv } from "@/server/env"
import { getFaqs, getPlans, getSetting } from "@/server/modules/content/queries"

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
    return (
      <JsonLd
        graph={graph([
          websiteNode({ origin, siteName: site.name }),
          businessNode({ origin, site, contact, seo }),
          personNode({ origin, site }),
        ])}
      />
    )
  }
  const hero = visible.find((b) => b.type === "hero.page")
  const nodes: Thing[] = [
    breadcrumbNode(origin, [
      { name: copy.breadcrumbHome || "Home", path: "/" },
      {
        name: hero?.type === "hero.page" ? hero.data.title : page.title,
        path: page.path,
      },
    ]),
  ]
  const faq = visible.find((b) => b.type === "faq")
  if (faq?.type === "faq")
    nodes.push(faqNode(select(await getFaqs(), faq.data.selection)))
  if (visible.some((b) => b.type === "services.plans")) {
    nodes.push(
      ...planNodes({
        origin,
        plans: (await getPlans()).slice(0, 4),
        siteName: site.name,
      })
    )
  }
  return <JsonLd graph={graph(nodes)} />
}
