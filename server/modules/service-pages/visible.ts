import "server-only"

import { sql } from "drizzle-orm"

import { pages, services } from "@/server/db/schema"

// A page is out of reach while the service it belongs to is hidden: it 404s
// and leaves the sitemap, llms.txt and the route table.
export const notHiddenServicePage = sql<boolean>`not exists (select 1 from ${services} where ${services.id} = ${pages.serviceId} and not ${services.isVisible})`
