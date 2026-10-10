import type { Metadata } from "next"
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"

import { Suspense } from "react"

import "./admin.css"
import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/components/theme-provider"
import { AdminFrame } from "./_frame/admin-frame"

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
})

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: { template: "%s · Admin", default: "Admin" },
  robots: { index: false, follow: false },
}

// Separate root layout: no Lenis, GSAP or site chrome, and its own tokens.
// next-themes sets `.light`/`.dark` on <html> from an inline script before
// hydration, hence suppressHydrationWarning on that element only. The script
// stays outside Suspense so the class is set before first paint; the fallback
// has no background of its own, so the body token (light or dark) shows.
export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-IE"
      data-theme="admin"
      className={cn(sans.variable, mono.variable)}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <Suspense fallback={<div className="min-h-svh" />}>
            <AdminFrame>{children}</AdminFrame>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  )
}
