import Image from "next/image"

import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import storyImage from "@/public/images/about/story.png"
import { ABOUT_STORY } from "../data/about-page-content"

export function StorySection() {
  const { eyebrow, title, body, quote, badge, role } = ABOUT_STORY

  return (
    <section
      aria-labelledby="story-heading"
      className="bg-white py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-12 lg:flex-row lg:items-stretch lg:gap-10 xl:gap-14">
        <div className="relative flex min-h-110 shrink-0 flex-col justify-end overflow-clip rounded-3xl p-6 lg:min-h-153 lg:w-[46%] xl:w-142">
          <div aria-hidden className="absolute inset-0">
            <div
              data-motion="parallax"
              className="absolute inset-x-0 -inset-y-[8%]"
            >
              <Image
                src={storyImage}
                alt=""
                fill
                placeholder="blur"
                sizes="(min-width: 1024px) 568px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-linear-to-b from-black/0 to-black/40" />
          </div>

          <div
            data-motion="rise"
            className="relative flex flex-col gap-1.5 self-start rounded-[20px] border border-white/16 bg-white/20 p-6 text-cream backdrop-blur-[8px]"
          >
            <span
              data-motion="count"
              className="font-display text-[40px] leading-[1.1] font-bold [font-variation-settings:'SOFT'_0,'WONK'_1]"
            >
              {badge.value}
            </span>
            <span className="w-40.5 text-sm leading-[1.45]">{badge.label}</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-7">
          <div className="flex flex-col items-start gap-4">
            <div data-motion="rise">
              <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
            </div>
            <h2
              id="story-heading"
              data-motion="words"
              className="text-[30px] leading-[1.24] font-semibold tracking-[-0.6px] text-ink sm:text-[38px]"
            >
              {title}
            </h2>
          </div>

          <div
            data-motion="stagger"
            className="flex flex-col gap-5 text-base leading-[1.65] text-ink-muted"
          >
            {body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <blockquote className="border-l-2 border-clay py-0.5 pl-5">
            <p data-motion="words" className="text-lg leading-[1.55] text-clay">
              {quote}
            </p>
          </blockquote>

          <div
            data-motion="rise"
            className="flex flex-wrap items-center gap-3.5"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-mint">
                <Image
                  src="/images/hero/logo-mark.svg"
                  alt=""
                  width={28}
                  height={28}
                />
              </span>
              <span className="font-display text-2xl leading-[1.5] font-semibold text-forest [font-variation-settings:'SOFT'_0,'WONK'_1]">
                Magda Kennedy
              </span>
            </div>
            <span aria-hidden className="h-5.5 w-px bg-[#cfcfcf]" />
            <span className="text-base leading-[1.5] text-[#525252]">
              {role}
            </span>
          </div>
        </div>
      </Container>
    </section>
  )
}
