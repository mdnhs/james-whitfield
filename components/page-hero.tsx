import Image, { type StaticImageData } from "next/image"
import Link from "next/link"

import { Container } from "@/components/layout/container"

// Title band for inner pages: photo under a dark gradient, breadcrumb, large
// serif title and a short line of context. The fixed site header overlays its
// top; the photo drifts inside an oversized frame as the band scrolls away.
export function PageHero({
  title,
  subtitle,
  image,
  imagePosition = "center",
  tint = 0.32,
  mirror = false,
}: {
  title: string
  subtitle: string
  image: StaticImageData
  // CSS object-position for the photo's crop.
  imagePosition?: string
  // Strength of the flat dark wash over the photo, on top of the gradient.
  tint?: number
  // Flip the photo horizontally, as some designs do.
  mirror?: boolean
}) {
  return (
    <section
      aria-labelledby="page-hero-heading"
      className="relative flex min-h-svh w-full flex-col overflow-clip bg-[#0d120f] lg:h-svh lg:min-h-190"
    >
      <div aria-hidden className="absolute inset-0">
        <div
          data-motion="parallax"
          className="absolute inset-x-0 -inset-y-[8%]"
        >
          <Image
            src={image}
            alt=""
            fill
            priority
            placeholder="blur"
            sizes="100vw"
            style={{ objectPosition: imagePosition }}
            className={mirror ? "-scale-x-100 object-cover" : "object-cover"}
          />
        </div>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(8,18,15,0.5) 0%, rgba(8,18,15,0) 30%, rgba(8,18,15,0) 55%, rgba(8,23,20,0.9) 100%), linear-gradient(rgba(10,23,20,${tint}), rgba(10,23,20,${tint}))`,
          }}
        />
      </div>

      <Container className="relative flex flex-1 flex-col justify-end gap-7 pb-14 lg:pb-18">
        <nav
          aria-label="Breadcrumb"
          data-motion="rise"
          data-reveal
          className="inline-flex items-center gap-2.25 self-start rounded-full border border-white/10 bg-[rgba(231,239,238,0.05)] py-2.25 pr-4 pl-3.5 text-sm leading-[1.5] backdrop-blur-sm"
        >
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-white"
          />
          <Link
            href="/"
            className="text-white/70 transition-colors hover:text-white"
          >
            Home
          </Link>
          <span aria-hidden className="text-white/40">
            /
          </span>
          <span aria-current="page" className="font-medium text-white">
            {title}
          </span>
        </nav>

        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <h1
            id="page-hero-heading"
            data-motion="rise"
            data-reveal
            className="font-display text-[64px] leading-[1.05] font-semibold text-white [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[96px] xl:text-[120px]"
          >
            {title}
          </h1>
          <p
            data-motion="rise"
            data-reveal
            data-delay="0.15"
            className="max-w-90 text-lg leading-[1.55] text-white/84 sm:text-xl"
          >
            {subtitle}
          </p>
        </div>
      </Container>
    </section>
  )
}
