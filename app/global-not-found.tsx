import type { Metadata } from "next"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { siteFontClassName } from "./(site)/fonts"
import "./(site)/site.css"
import { NotFoundView } from "@/components/not-found-view"

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
}

// With several root layouts there is no top-level layout to wrap Next's 404,
// so URLs no route matches render this page. It is prerendered, which cannot
// wait for the database, so it carries no chrome; site 404s render
// app/(site)/not-found.tsx inside the site layout, chrome included.
export default function GlobalNotFound() {
  return (
    <html lang="en-IE" className={siteFontClassName}>
      <body>
        <NuqsAdapter>
          <main data-page-root>
            <NotFoundView />
          </main>
        </NuqsAdapter>
      </body>
    </html>
  )
}
