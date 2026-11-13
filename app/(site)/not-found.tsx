import { NotFoundView } from "@/components/not-found-view"
import { PageMotion } from "@/components/page-motion"

// Renders inside the site layout, so the chrome comes from SiteFrame.
export default function NotFound() {
  return (
    <main data-page-root>
      <NotFoundView />
      <PageMotion />
    </main>
  )
}
