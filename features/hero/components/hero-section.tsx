import { Container } from "@/components/layout/container"
import { HeroBackground } from "./hero-background"
import { HeroContent } from "./hero-content"
import { HeroMotion } from "./hero-motion"
import { MemberBadge } from "./member-badge"

export function HeroSection() {
  return (
    <HeroMotion className="relative flex min-h-svh w-full flex-col overflow-clip bg-[#888] lg:h-svh lg:min-h-190">
      <HeroBackground />

      {/* Copy sits low on desktop, ending 60px above the member badge
          (badge: 56px from the bottom + 72px tall + 60px = 188px). Top padding
          still clears the 100px site header, which overlays the hero. */}
      <Container
        data-hero="foreground"
        className="relative z-10 flex flex-1 flex-col justify-end pt-36 pb-14 lg:pt-28 lg:pb-47"
      >
        <HeroContent />
        <MemberBadge className="mt-12 self-start lg:absolute lg:right-14 lg:bottom-14 lg:mt-0" />
      </Container>
    </HeroMotion>
  )
}
