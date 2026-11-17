import type { MetadataRoute } from "next"
import { connection } from "next/server"

import { robotsFor } from "@/lib/seo/robots"
import { getEnv } from "@/server/env"
import { getSetting } from "@/server/modules/content/queries"
import { getSiteOrigin } from "@/server/modules/seo/site-origin"

// Read at request time so one image serves staging and production.
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection()
  const { SITE_ENV } = getEnv()
  return robotsFor(SITE_ENV, await getSetting("seo"), await getSiteOrigin())
}
