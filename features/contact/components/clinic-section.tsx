import type { BlockView } from "@/blocks/media-refs"
import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { MediaImage } from "@/components/media-image"
import { clinicAddress, mapsUrl } from "@/lib/content/address"
import type { GlobalView } from "@/lib/content/types"

export function ClinicSection({
  id,
  content,
  contact,
  directionsLabel,
}: {
  id: string
  content: BlockView<"contact.clinic">
  contact: GlobalView<"contact">
  directionsLabel: string
}) {
  const { eyebrow, title, subtitle } = content

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-white py-12 sm:py-20 lg:py-28"
    >
      <Container className="flex flex-col gap-6 sm:gap-10">
        <div className="flex flex-col gap-3 sm:gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-14">
          <div className="flex flex-col items-start gap-3 sm:gap-4">
            <div data-motion="rise">
              <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
            </div>
            <h2
              id={`${id}-heading`}
              data-motion="words"
              className="max-w-168 font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-ink [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px] sm:leading-[1.3] sm:tracking-normal sm:text-pine"
            >
              {title}
            </h2>
          </div>
          <p
            data-motion="rise"
            className="max-w-118 text-[15px] leading-5.75 text-[#686561] sm:text-base sm:leading-[1.5] sm:text-text-muted"
          >
            {subtitle}
          </p>
        </div>

        {/* Phones: a sage card, photo on top and the address beneath; sm+:
            the address floats in frosted glass over a full photo. */}
        <div className="relative flex flex-col overflow-clip rounded-3xl bg-stone sm:min-h-130 sm:justify-start sm:rounded-[28px] sm:bg-transparent sm:p-10">
          <div
            aria-hidden
            className="relative h-42 overflow-clip sm:absolute sm:inset-0 sm:h-auto"
          >
            <div
              data-motion="parallax"
              className="absolute inset-x-0 -inset-y-[8%]"
            >
              <MediaImage
                media={content.photo}
                fill
                blur
                sizes="(min-width: 1440px) 1308px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="absolute inset-0 hidden bg-linear-to-r from-pine/80 to-pine/0 to-55% sm:block" />
          </div>

          <address
            data-motion="rise"
            className="relative flex w-full flex-col items-start gap-2 p-5 not-italic sm:max-w-90 sm:gap-3.5 sm:rounded-[20px] sm:border sm:border-white/16 sm:bg-white/16 sm:p-7 sm:backdrop-blur-[12px]"
          >
            <p className="text-xl leading-6.5 font-semibold tracking-[-0.2px] text-pine sm:text-2xl sm:leading-[1.5] sm:tracking-[-0.48px] sm:text-white">
              {contact.clinic.name}
            </p>
            <p className="text-[15px] leading-5.75 text-ink-muted sm:max-w-58 sm:text-base sm:leading-[1.6] sm:text-white/80">
              {clinicAddress(contact.address)}
            </p>
            <span
              aria-hidden
              className="hidden h-px w-full bg-line-soft sm:block"
            />
            <p className="text-[13px] leading-4.75 text-[#686561] sm:text-base sm:leading-[1.6] sm:text-white/80">
              {contact.clinic.onlineNote}
            </p>
            <a
              href={mapsUrl(contact.address)}
              target="_blank"
              rel="noopener noreferrer"
              data-magnetic
              className="mt-2 flex h-13 w-full items-center justify-center rounded-full border border-brand text-base leading-5 font-semibold whitespace-pre text-brand transition-colors hover:bg-brand/5 sm:mt-0 sm:inline-block sm:h-auto sm:w-auto sm:border-0 sm:bg-clay sm:px-5.5 sm:py-3.25 sm:text-[14.5px] sm:leading-[1.5] sm:text-cream sm:hover:bg-clay/90"
            >
              {directionsLabel}
            </a>
          </address>
        </div>
      </Container>
    </section>
  )
}
