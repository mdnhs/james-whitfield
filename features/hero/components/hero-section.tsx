import { Container } from "@/components/layout/container"
import { HeroBackground } from "./hero-background"
import { HeroContent } from "./hero-content"
import { MemberBadge } from "./member-badge"

export function HeroSection() {
  return (
    <section className="relative flex min-h-svh w-full flex-col overflow-clip bg-[#888] lg:h-svh lg:min-h-180">
      <HeroBackground />

      {/* Top padding clears the 100px site header, which overlays the hero from the layout. */}
      <Container className="relative z-10 flex flex-1 flex-col pt-41 pb-14 lg:pt-51">
        <HeroContent />
        <MemberBadge className="mt-12 self-start lg:absolute lg:right-14 lg:bottom-14 lg:mt-0" />
      </Container>
    </section>
  )
}
