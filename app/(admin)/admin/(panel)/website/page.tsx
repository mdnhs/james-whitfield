import { redirect } from "next/navigation"
import { Suspense } from "react"

import { websiteHref } from "@/lib/admin/website"
import { requireActor } from "@/server/auth/session"

// The Website menu has no screen of its own: open its first page, Home.
export default function WebsiteIndex() {
  return (
    <Suspense fallback={null}>
      <Go />
    </Suspense>
  )
}

// Signed in first, as every Website screen, so a stranger lands on sign-in
// and comes back here.
async function Go(): Promise<never> {
  await requireActor("/admin/website")
  redirect(websiteHref("home"))
}
