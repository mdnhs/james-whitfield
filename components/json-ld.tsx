import type { Graph } from "schema-dts"

import { jsonLd } from "@/lib/seo/json-ld"

// Ruling R18: one script per page holding an @graph.
export function JsonLd({ graph }: { graph: Graph }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(graph) }}
    />
  )
}
