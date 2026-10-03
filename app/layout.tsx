import {
  DM_Mono,
  Fraunces,
  Geist,
  Geist_Mono,
  IBM_Plex_Mono,
  Inter,
  Plus_Jakarta_Sans,
} from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SiteFooter } from "@/features/footer"
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-fraunces",
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
})

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-mono-family",
})

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-ibm-plex-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        geist.variable,
        fraunces.variable,
        jakarta.variable,
        dmMono.variable,
        plexMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <ThemeProvider>
          {children}
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  )
}
