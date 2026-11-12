import Image from "next/image"

import type { BlockView } from "@/blocks/media-refs"
import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"

// "What it is & who it's for": the service in the editor's words on the
// left, and on the right the "this is for you if" list as a pine card (the
// good-fit list of FitSection, kept as a card at every width).
export function ServiceIntroSection({
  id,
  content,
}: {
  id: string
  content: BlockView<"service.intro">
}) {
  const { eyebrow, title, body, forYouHeading, forYou } = content
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-cream py-12 sm:bg-white sm:py-20 lg:py-30"
    >
      <Container className="grid grid-cols-1 gap-6 sm:gap-14 lg:grid-cols-2 lg:items-start lg:gap-16 xl:gap-24">
        <div className="flex flex-col items-start gap-3 sm:gap-6">
          <div data-motion="rise">
            <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
          </div>
          <h2
            id={`${id}-heading`}
            data-motion="words"
            className="max-w-145 font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-forest [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px] sm:leading-[1.2] sm:tracking-normal sm:text-pine"
          >
            {title}
          </h2>
          <div data-motion="rise" className="flex max-w-152 flex-col gap-4">
            {paragraphs.map((paragraph, i) => (
              <p
                key={i}
                className="text-[15px] leading-5.75 text-[#686561] sm:text-lg sm:leading-[1.6] sm:text-text-muted"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div
          data-motion="rise"
          className="flex flex-col gap-3.5 rounded-[22px] bg-pine px-5 py-5.5 sm:gap-6 sm:rounded-3xl sm:p-9 xl:p-12"
        >
          <h3 className="text-xl leading-6.5 font-semibold tracking-[-0.2px] text-cream sm:text-2xl sm:leading-[1.2] sm:tracking-normal">
            {forYouHeading}
          </h3>
          <ul data-motion="stagger" className="flex flex-col gap-3.5 sm:gap-5">
            {forYou.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-[15px] leading-5.75 text-cream sm:text-lg sm:leading-[1.4] sm:font-medium sm:tracking-[-0.18px]"
              >
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-clay"
                >
                  <Image
                    src="/images/services/icon-check-light.svg"
                    alt=""
                    width={11.1571}
                    height={8.20216}
                  />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  )
}
