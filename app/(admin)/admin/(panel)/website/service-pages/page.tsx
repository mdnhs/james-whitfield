import { redirect } from "next/navigation"
import { Suspense } from "react"

import { requireActor } from "@/server/auth/session"

// Service pages are edited from Services now (each service opens one
// editor for its card, details page and SEO).
export default function ServicePages() {
  return (
    <Suspense fallback={null}>
      <Go />
    </Suspense>
  )
}

async function Go(): Promise<never> {
  await requireActor("/admin/website/service-pages")
  redirect("/admin/website/services")
}
