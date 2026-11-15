import "server-only"

import { io } from "next/cache"

import type { AdminBrand } from "@/admin/components/brand-mark"
import { getSetting } from "@/server/modules/content/queries"

import { getBrandLogo } from "./brand"

// The admin shows the site's name and logo from Identity, as the site does.
// Request time (io): the build has no database, and the sign-in pages would
// otherwise be prerendered with it.
export async function getAdminBrand(): Promise<AdminBrand> {
  await io()
  const site = await getSetting("site")
  return { name: site.name, logo: await getBrandLogo(site) }
}
