import Link from "next/link"

import type { BlockView } from "@/blocks/media-refs"
import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ctaTrackAttrs } from "@/lib/tracking/cta"

export function CredentialsSection({
  id,
  content,
}: {
  id: string
  content: BlockView<"about.credentials">
}) {
  const { eyebrow, title, subtitle, cta, items } = content

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-white py-12 sm:bg-stone sm:py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-6 sm:gap-12 lg:flex-row lg:items-start lg:gap-14">
        {/* Intro stays in view while the timeline scrolls past on desktop. On
            phones it dissolves (contents) so the CTA can close the list. */}
        <div className="contents sm:flex sm:flex-col sm:items-start sm:gap-9 lg:sticky lg:top-28 lg:w-105 lg:shrink-0">
          <div className="flex flex-col items-start gap-3 sm:gap-4">
            <div data-motion="rise">
              <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
            </div>
            <h2
              id={`${id}-heading`}
              data-motion="words"
              className="font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-ink [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px] sm:leading-[1.24] sm:tracking-normal sm:text-pine"
            >
              {title}
            </h2>
            <p
              data-motion="rise"
              className="max-w-111.5 text-[15px] leading-5.75 text-[#686561] sm:text-base sm:leading-[1.6] sm:text-text-muted"
            >
              {subtitle}
            </p>
          </div>

          <Link
            href={cta.href}
            {...ctaTrackAttrs(cta.href, id)}
            data-motion="rise"
            data-magnetic
            className={cn(
              buttonVariants(),
              "order-last h-13 w-full rounded-full bg-clay px-6 py-0 text-base leading-5 font-semibold whitespace-pre text-cream hover:bg-clay/90 sm:order-none sm:h-auto sm:w-auto sm:px-7 sm:py-4 sm:leading-[1.5]"
            )}
          >
            {cta.label}
          </Link>
        </div>

        <ol
          data-motion="deal-group"
          className="flex min-w-0 flex-1 flex-col sm:gap-2"
        >
          {items.map(({ year, title, issuer, url }, i) => (
            <li
              key={i}
              className="group flex items-center gap-3.5 border-b border-[#e3e5dc] py-4 sm:gap-10 sm:py-6.5"
            >
              <span className="shrink-0 rounded-[10px] bg-clay/10 px-2.5 py-1.5 font-plex-mono text-xs leading-4 font-medium tracking-[1px] text-clay tabular-nums sm:rounded-none sm:bg-transparent sm:p-0 sm:font-sans sm:text-[15px] sm:leading-[1.5] sm:font-normal sm:tracking-normal">
                {year}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 transition-transform duration-500 ease-out group-hover:translate-x-1.5 sm:gap-1.5">
                <h3 className="text-[17px] leading-6 font-semibold text-ink sm:text-xl sm:leading-[1.3] sm:text-text-strong">
                  {url ? (
                    <a href={url} rel="noreferrer" target="_blank">
                      {title}
                    </a>
                  ) : (
                    title
                  )}
                </h3>
                <p className="text-[13px] leading-4.75 text-[#686561] sm:text-base sm:leading-[1.5] sm:text-text-muted">
                  {issuer}
                </p>
              </div>
              <span
                aria-hidden
                className="text-base leading-none text-brand transition-transform duration-500 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:text-xl sm:leading-[1.5]"
              >
                ↗
              </span>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}
