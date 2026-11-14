import "server-only"

import type { AdminBrand } from "@/admin/components/brand-mark"
import { getSetting } from "@/server/modules/content/queries"

import { getBrandLogo } from "./brand"

// The admin shows the site's name and logo from Identity, as the site does.
export async function getAdminBrand(): Promise<AdminBrand> {
  const site = await getSetting("site")
  return { name: site.name, logo: await getBrandLogo(site) }
}
