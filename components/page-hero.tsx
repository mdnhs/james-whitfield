import Link from "next/link"

import type { BlockView } from "@/blocks/media-refs"
import { Container } from "@/components/layout/container"
import { MediaImage } from "@/components/media-image"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// The home hero's primary pill (features/hero/components/hero-content.tsx):
// 52px full-width on phones, 50px auto-width from sm.
const ctaClass =
  "h-13 w-full sm:h-12.5 sm:w-auto rounded-full px-6 sm:px-[27px] py-0 text-base sm:text-[15px] font-semibold leading-5 sm:leading-[normal] bg-white text-brand hover:bg-white/90"

// Title band for inner pages: photo under a dark gradient, breadcrumb, large
// serif title and a short line of context. The fixed site header overlays its
// top; the photo drifts inside an oversized frame as the band scrolls away.
export function PageHero({
  content,
  homeLabel,
}: {
  content: BlockView<"hero.page">
  homeLabel: string
}) {
  const { title, subtitle, image, focal, tint, mirror, cta } = content
  return (
    <section
      aria-labelledby="page-hero-heading"
      // Mobile: a compact band with rounded bottom corners over white (the
      // page continues in white beneath them); sm+: the full-height hero.
      className="relative flex w-full flex-col overflow-clip bg-white sm:min-h-svh sm:bg-hero-base lg:h-svh lg:min-h-190"
    >
      <div
        aria-hidden
        className="absolute inset-0 overflow-clip rounded-b-[28px] bg-hero-base sm:rounded-none"
      >
        <div
          data-motion="parallax"
          className="absolute inset-x-0 -inset-y-[8%]"
        >
          <MediaImage
            media={image}
            focal={focal}
            alt=""
            fill
            priority
            blur
            sizes="100vw"
            className={mirror ? "-scale-x-100 object-cover" : "object-cover"}
          />
        </div>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(8,18,15,0.5) 0%, rgba(8,18,15,0) 30%, rgba(8,18,15,0) 55%, rgba(8,23,20,0.9) 100%), linear-gradient(rgba(10,23,20,${tint}), rgba(10,23,20,${tint}))`,
          }}
        />
        {/* Mobile: the short band reads under one even teal wash. */}
        <div className="absolute inset-0 bg-linear-to-b from-[rgba(8,20,18,0.7)] to-[rgba(10,38,38,0.92)] sm:hidden" />
      </div>

      <Container className="relative flex flex-1 flex-col justify-end gap-3.5 pt-25 pb-9 sm:gap-7 sm:pt-0 sm:pb-14 lg:pb-18">
        <nav
          aria-label="Breadcrumb"
          data-motion="rise"
          data-reveal
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/10 bg-[rgba(231,239,238,0.05)] px-3 py-1.5 text-[13px] leading-4.75 backdrop-blur-sm sm:gap-2.25 sm:py-2.25 sm:pr-4 sm:pl-3.5 sm:text-sm sm:leading-[1.5]"
        >
          <span
            aria-hidden
            className="hidden size-1.5 shrink-0 rounded-full bg-white sm:block"
          />
          <Link
            href="/"
            className="text-white/70 transition-colors hover:text-white"
          >
            {homeLabel}
          </Link>
          <span aria-hidden className="text-white/40">
            /
          </span>
          <span aria-current="page" className="font-medium text-white">
            {title}
          </span>
        </nav>

        <div className="flex flex-col gap-3.5 sm:gap-6 xl:flex-row xl:items-end xl:justify-between">
          <h1
            id="page-hero-heading"
            data-motion="rise"
            data-reveal
            className="font-display text-[40px] leading-11 font-bold tracking-[-0.5px] text-white [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[96px] sm:leading-[1.05] sm:font-semibold sm:tracking-normal xl:text-[120px]"
          >
            {title}
          </h1>
          <div className="flex flex-col items-start gap-5 sm:gap-6">
            <p
              data-motion="rise"
              data-reveal
              data-delay="0.15"
              className="max-w-90 text-[17px] leading-6.5 text-mist sm:text-xl sm:leading-[1.55] sm:text-white/84"
            >
              {subtitle}
            </p>
            {cta && (
              <div
                data-motion="rise"
                data-reveal
                data-delay="0.25"
                className="w-full sm:w-auto"
              >
                <Link
                  href={cta.href}
                  data-magnetic
                  className={cn(buttonVariants(), ctaClass)}
                >
                  {cta.label}
                </Link>
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  )
}
