import Image from "next/image"

import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import clinicImage from "@/public/images/insights/post-host-podcast.png"
import { CLINIC } from "../data/contact-content"

export function ClinicSection() {
  const { eyebrow, title, subtitle, name, address, online, directions } = CLINIC

  return (
    <section
      id="clinic"
      aria-labelledby="clinic-heading"
      className="bg-white py-20 lg:py-28"
    >
      <Container className="flex flex-col gap-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-14">
          <div className="flex flex-col items-start gap-4">
            <div data-motion="rise">
              <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
            </div>
            <h2
              id="clinic-heading"
              data-motion="words"
              className="max-w-168 font-display text-[38px] leading-[1.3] font-bold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
            >
              {title}
            </h2>
          </div>
          <p
            data-motion="rise"
            className="max-w-118 text-base leading-[1.5] text-[#525252]"
          >
            {subtitle}
          </p>
        </div>

        <div className="relative flex min-h-130 flex-col justify-end overflow-clip rounded-[28px] p-5 sm:justify-start sm:p-10">
          <div aria-hidden className="absolute inset-0">
            <div
              data-motion="parallax"
              className="absolute inset-x-0 -inset-y-[8%]"
            >
              <Image
                src={clinicImage}
                alt=""
                fill
                placeholder="blur"
                sizes="(min-width: 1440px) 1308px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-linear-to-r from-pine/80 to-pine/0 to-55%" />
          </div>

          <address
            data-motion="rise"
            className="relative flex w-full max-w-90 flex-col items-start gap-3.5 rounded-[20px] border border-white/16 bg-white/16 p-7 not-italic backdrop-blur-[12px]"
          >
            <p className="text-2xl leading-[1.5] font-semibold tracking-[-0.48px] text-white">
              {name}
            </p>
            <p className="max-w-58 text-base leading-[1.6] text-white/80">
              {address}
            </p>
            <span aria-hidden className="h-px w-full bg-[#e7e9e0]" />
            <p className="text-base leading-[1.6] text-white/80">{online}</p>
            <a
              href={directions.href}
              target="_blank"
              rel="noopener noreferrer"
              data-magnetic
              className="rounded-full bg-clay px-5.5 py-3.25 text-[14.5px] leading-[1.5] font-semibold whitespace-pre text-cream transition-colors hover:bg-clay/90"
            >
              {directions.label}
            </a>
          </address>
        </div>
      </Container>
    </section>
  )
}
