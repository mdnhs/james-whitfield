import { Check } from "lucide-react"
import Link from "next/link"

import { Container } from "@/components/layout/container"
import { MediaImage } from "@/components/media-image"
import { buttonVariants } from "@/components/ui/button"
import type { CtaBandView } from "@/lib/content/types"
import { tintStyle } from "@/lib/tint"
import { cn } from "@/lib/utils"
import { EnterpriseBackdrop } from "./enterprise-backdrop"
import { ctaTrackAttrs } from "@/lib/tracking/cta"

// Full-bleed photo band with a centred call to action. The home page uses it
// for enterprise programmes; other pages pass their own copy and tint.
export function EnterpriseSection({
  id,
  band,
  tint,
}: {
  id: string
  band: CtaBandView
  tint?: number | null
}) {
  const { eyebrow, title, bullets, cta } = band

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      // Mobile: an inset rounded card on white; sm+: the full-bleed band (the
      // card wrapper becomes `display: contents`).
      className="relative overflow-clip bg-white p-4 sm:flex sm:min-h-145 sm:items-center sm:bg-transparent sm:p-0 sm:py-20"
    >
      <div className="relative overflow-clip rounded-[28px] px-6 pt-8 pb-7 sm:contents">
        <EnterpriseBackdrop>
          <MediaImage
            media={band.image}
            alt=""
            fill
            sizes="100vw"
            blur
            className="object-cover"
          />
          <div
            className="absolute inset-0"
            style={tintStyle(tint ?? band.tint)}
          />
        </EnterpriseBackdrop>

        <Container className="relative flex flex-col items-start gap-5 px-0 text-left sm:items-center sm:gap-7 sm:px-6 sm:text-center lg:px-16.5">
          <span
            data-motion="rise"
            className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1.5 font-geist text-[13px] leading-4.75 whitespace-nowrap text-forest sm:h-8 sm:border-[0.8px] sm:border-line-neutral sm:bg-white sm:px-3.5 sm:py-0 sm:text-sm sm:leading-4.5 sm:tracking-[-0.28px] sm:text-moss"
          >
            <span
              aria-hidden
              className="hidden size-1 rounded-full bg-moss sm:block"
            />
            {eyebrow}
          </span>

          <h2
            id={`${id}-heading`}
            data-motion="words"
            className="max-w-214 font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-cream [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[50px] sm:leading-[1.15] sm:tracking-normal"
          >
            {title}
          </h2>

          <ul
            data-motion="stagger"
            className="flex w-full flex-col items-start gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-10"
          >
            {bullets.map((bullet, i) => (
              <li
                key={i}
                className="flex items-center gap-2.5 text-[15px] leading-5.75 text-cream sm:text-sm sm:leading-[normal] sm:whitespace-nowrap"
              >
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-clay sm:hidden"
                >
                  <Check className="size-3 text-white" strokeWidth={3} />
                </span>
                <span
                  aria-hidden
                  className="hidden h-0.5 w-4 shrink-0 bg-clay sm:block"
                />
                {bullet}
              </li>
            ))}
          </ul>

          <Link
            href={cta.href}
            {...ctaTrackAttrs(cta.href, id)}
            data-motion="rise"
            data-magnetic
            className={cn(
              buttonVariants(),
              "mt-2 h-auto min-h-13 w-full max-w-full rounded-full bg-white px-6 py-3.5 text-center text-base leading-5 font-semibold whitespace-normal text-brand hover:bg-white/90 sm:mt-0 sm:min-h-12.5 sm:w-auto sm:bg-clay sm:px-[27px] sm:text-[15px] sm:leading-[1.35] sm:whitespace-nowrap sm:text-cream sm:hover:bg-clay/90"
            )}
          >
            {cta.label}
          </Link>
        </Container>
      </div>
    </section>
  )
}
