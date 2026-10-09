import type { Metadata } from "next"
import Link from "next/link"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { siteFontClassName } from "./(site)/fonts"
import "./(site)/site.css"
import { Container } from "@/components/layout/container"
import { SiteFooter } from "@/features/footer"
import { SiteHeader } from "@/features/navbar"

export const metadata: Metadata = {
  title: "Page not found",
}

// With several root layouts there is no top-level layout to wrap Next's 404,
// so unmatched URLs render this page: the site chrome around a plain message.
export default function GlobalNotFound() {
  return (
    <html lang="en-IE" className={siteFontClassName}>
      <body>
        <NuqsAdapter>
          <SiteHeader />
          <main data-page-root>
            <Container className="py-32 text-center">
              <h1 className="text-3xl font-semibold">Page not found</h1>
              <p className="mt-4">This page does not exist.</p>
              <Link href="/" className="mt-8 inline-block underline">
                Back to home
              </Link>
            </Container>
          </main>
          <SiteFooter />
        </NuqsAdapter>
      </body>
    </html>
  )
}
