import type { MetadataRoute } from "next"
import { connection } from "next/server"

import { robotsFor } from "@/lib/seo/robots"
import { getEnv } from "@/server/env"
import { getSetting } from "@/server/modules/content/queries"

// Read at request time so one image serves staging and production.
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection()
  const { SITE_ENV, SITE_URL } = getEnv()
  return robotsFor(SITE_ENV, await getSetting("seo"), SITE_URL)
}
