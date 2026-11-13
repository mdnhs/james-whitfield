import type { Metadata } from "next"

import { siteFontClassName } from "../(site)/fonts"

import "../(site)/site.css"

// Admin-only previews of site pieces, shown in an iframe inside the admin:
// the site's own CSS and fonts, nothing else (no header, footer or chat).
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function EmbedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IE" className={siteFontClassName}>
      <body className="bg-transparent">{children}</body>
    </html>
  )
}
