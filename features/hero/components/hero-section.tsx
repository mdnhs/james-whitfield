import { SiteHeader } from "@/features/navbar"
import { HeroBackground } from "./hero-background"
import { HeroContent } from "./hero-content"
import { MemberBadge } from "./member-badge"

export function HeroSection() {
  return (
    <section className="relative flex min-h-svh w-full flex-col overflow-clip bg-[#888] lg:h-svh lg:min-h-180">
      <HeroBackground />

      <SiteHeader />

      <div className="relative z-10 mx-auto flex w-full max-w-360 flex-1 flex-col px-4 pt-16 pb-14 sm:px-6 lg:px-16.5 lg:pt-26">
        <HeroContent />
        <MemberBadge className="mt-12 self-start lg:absolute lg:right-14 lg:bottom-14 lg:mt-0" />
      </div>
    </section>
  )
}
