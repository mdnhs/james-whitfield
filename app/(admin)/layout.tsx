import type { Metadata } from "next"
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"

import "./admin.css"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

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
// Light only until the Phase 2 theme switch adds the `.dark` class.
export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-IE"
      data-theme="admin"
      className={cn(sans.variable, mono.variable)}
    >
      <body>
        {children}
        <Toaster theme="light" position="top-center" />
      </body>
    </html>
  )
}
