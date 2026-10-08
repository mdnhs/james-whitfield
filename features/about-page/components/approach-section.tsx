import Image from "next/image"

import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { ABOUT_APPROACH } from "../data/about-page-content"

export function ApproachSection() {
  const { eyebrow, title, subtitle, principles } = ABOUT_APPROACH

  return (
    <section
      aria-labelledby="approach-heading"
      className="bg-white py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-14">
        <header className="flex flex-col items-center gap-3 text-center">
          <div data-motion="rise">
            <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
          </div>
          <h2
            id="approach-heading"
            data-motion="words"
            className="max-w-160 font-display text-[38px] leading-[1.3] font-bold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
          >
            {title}
          </h2>
          <p
            data-motion="rise"
            className="max-w-152 text-base leading-[1.6] text-[#525252]"
          >
            {subtitle}
          </p>
        </header>

        <ul
          data-motion="deal-group"
          className="grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          {principles.map(({ icon, title, body }) => (
            <li
              key={title}
              data-motion="deal tilt"
              data-tilt="4"
              className="relative flex flex-col gap-6 overflow-clip rounded-[20px] bg-stone p-6 lg:p-8"
            >
              <span className="flex self-start rounded-[14px] bg-mist p-3.5">
                <Image src={icon} alt="" width={24} height={24} />
              </span>
              <div className="flex flex-col gap-3.5">
                <h3 className="font-geist text-xl leading-[1.3] font-semibold text-[#0c0c0c] lg:text-2xl">
                  {title}
                </h3>
                <p className="text-sm leading-[1.65] text-[#525252]">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
