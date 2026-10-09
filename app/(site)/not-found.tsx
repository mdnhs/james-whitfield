import Link from "next/link"

import { Container } from "@/components/layout/container"

// Renders inside the site layout, so the chrome comes from SiteFrame.
export default function NotFound() {
  return (
    <main data-page-root>
      <Container className="py-32 text-center">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="mt-4">This page does not exist.</p>
        <Link href="/" className="mt-8 inline-block underline">
          Back to home
        </Link>
      </Container>
    </main>
  )
}
