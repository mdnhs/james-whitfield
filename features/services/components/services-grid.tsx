import { Eyebrow } from "@/components/eyebrow"
import type { BlockView } from "@/blocks/media-refs"
import { Container } from "@/components/layout/container"
import type { ServiceView } from "@/lib/content/types"

import { ServiceCardTile } from "./service-card-tile"

export function ServicesGrid({
  id,
  content,
  services,
}: {
  id: string
  content: BlockView<"services.grid">
  services: ServiceView[]
}) {
  const { eyebrow, title, intro, more } = content

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-white pt-10 pb-12 sm:bg-stone sm:py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-6 sm:gap-14">
        <div className="flex flex-col gap-3 sm:gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-14">
          <div className="flex flex-col items-start gap-3 sm:gap-4">
            <div data-motion="rise">
              <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
            </div>
            <h2
              id={`${id}-heading`}
              data-motion="words"
              className="max-w-140 font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-ink [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-5xl sm:leading-[1.22] sm:font-semibold sm:tracking-[-1.2px] sm:text-pine"
            >
              {title}
            </h2>
          </div>
          <p
            data-motion="rise"
            className="max-w-125 text-[15px] leading-5.75 text-[#686561] sm:text-base sm:leading-[1.6] sm:text-ink-muted"
          >
            {intro}
          </p>
        </div>

        <ul
          data-motion="deal-group"
          className="grid grid-cols-1 gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {services.map(({ id: serviceId, icon, title, body, pagePath }) => (
            <ServiceCardTile
              key={serviceId}
              icon={icon}
              title={title}
              body={body}
              href={pagePath || null}
              moreLabel={more.label}
            />
          ))}
        </ul>
      </Container>
    </section>
  )
}
