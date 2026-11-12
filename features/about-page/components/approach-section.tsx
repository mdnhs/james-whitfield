import type { BlockView } from "@/blocks/media-refs"
import { Icon } from "@/components/icons/icon"

import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"

export function ApproachSection({
  id,
  content,
}: {
  id: string
  content: BlockView<"about.approach">
}) {
  const { eyebrow, title, subtitle, principles } = content

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-cream py-12 sm:bg-white sm:py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-6 sm:gap-14">
        <header className="flex flex-col items-start gap-3 text-left sm:items-center sm:text-center">
          <div data-motion="rise">
            <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
          </div>
          <h2
            id={`${id}-heading`}
            data-motion="words"
            className="max-w-160 font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-forest [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px] sm:leading-[1.3] sm:tracking-normal sm:text-pine"
          >
            {title}
          </h2>
          <p
            data-motion="rise"
            className="max-w-152 text-[15px] leading-5.75 text-[#686561] sm:text-base sm:leading-[1.6] sm:text-text-muted"
          >
            {subtitle}
          </p>
        </header>

        <ul
          data-motion="deal-group"
          className="grid grid-cols-1 gap-3 sm:gap-6 md:grid-cols-3"
        >
          {principles.map(({ icon, title, body }, i) => (
            <li
              key={i}
              data-motion="deal tilt"
              data-tilt="4"
              className="relative flex flex-col gap-2.5 overflow-clip rounded-[20px] bg-white p-5 sm:gap-6 sm:bg-stone sm:p-6 lg:p-8"
            >
              <span className="flex self-start rounded-[14px] bg-mist p-2.75 sm:p-3.5">
                <Icon name={icon} className="text-pine" />
              </span>
              <div className="flex flex-col gap-2.5 sm:gap-3.5">
                <h3 className="font-geist text-xl leading-6.5 font-semibold tracking-[-0.2px] text-ink sm:leading-[1.3] sm:tracking-normal sm:text-text-strong lg:text-2xl">
                  {title}
                </h3>
                <p className="text-[15px] leading-5.75 text-[#686561] sm:text-sm sm:leading-[1.65] sm:text-text-muted">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
