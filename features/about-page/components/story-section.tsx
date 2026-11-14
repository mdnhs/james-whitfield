import type { BlockView } from "@/blocks/media-refs"
import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { LogoMark } from "@/components/logo-mark"
import { MediaImage } from "@/components/media-image"
import { StatValue } from "@/components/stat-value"
import { NO_BRAND_LOGO, type BrandLogo } from "@/lib/brand"

export function StorySection({
  id,
  content,
  siteName,
  logo = NO_BRAND_LOGO,
}: {
  id: string
  content: BlockView<"about.story">
  siteName: string
  logo?: BrandLogo
}) {
  const { eyebrow, title, paragraphs, quote, badge, role, photo } = content

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-white pt-10 pb-12 sm:py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-5 sm:gap-12 lg:flex-row lg:items-stretch lg:gap-10 xl:gap-14">
        <div className="relative flex h-95 shrink-0 flex-col justify-end overflow-clip rounded-3xl p-3.5 sm:h-auto sm:min-h-110 sm:p-6 lg:min-h-153 lg:w-[46%] xl:w-142">
          <div aria-hidden className="absolute inset-0">
            <div
              data-motion="parallax"
              className="absolute inset-x-0 -inset-y-[8%]"
            >
              <MediaImage
                media={photo}
                fill
                blur
                sizes="(min-width: 1024px) 568px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="absolute inset-0 hidden bg-linear-to-b from-black/0 to-black/40 sm:block" />
          </div>

          <div
            data-motion="rise"
            // Mobile: a white chip, the value in a pine tile beside the label;
            // sm+: the frosted card with the value set large above it.
            className="relative flex items-center gap-3 self-start rounded-[18px] bg-white py-3 pr-4 pl-3 text-pine sm:flex-col sm:items-start sm:gap-1.5 sm:rounded-[20px] sm:border sm:border-white/16 sm:bg-white/20 sm:p-6 sm:text-cream sm:backdrop-blur-[8px]"
          >
            <StatValue
              stat={badge.value}
              className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-pine text-[17px] leading-6 font-semibold text-white sm:block sm:size-auto sm:rounded-none sm:bg-transparent sm:font-display sm:text-[40px] sm:leading-[1.1] sm:font-bold sm:text-cream sm:[font-variation-settings:'SOFT'_0,'WONK'_1]"
            />
            <span className="w-36 text-[13px] leading-4.75 sm:w-40.5 sm:text-sm sm:leading-[1.45]">
              {badge.label}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-5 sm:gap-7">
          <div className="flex flex-col items-start gap-5 sm:gap-4">
            <div data-motion="rise">
              <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
            </div>
            <h2
              id={`${id}-heading`}
              data-motion="words"
              className="font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-ink [font-variation-settings:'SOFT'_0,'WONK'_1] sm:font-sans sm:text-[38px] sm:leading-[1.24] sm:font-semibold sm:tracking-[-0.6px] sm:[font-variation-settings:normal]"
            >
              {title}
            </h2>
          </div>

          <div
            data-motion="stagger"
            className="flex flex-col gap-5 text-[15px] leading-5.75 text-ink-muted sm:text-base sm:leading-[1.65]"
          >
            {paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          {/* Mobile: quote and signature share one sage card; sm+: the card
              dissolves (contents) into the bordered quote and signature row. */}
          <div className="flex flex-col gap-3 rounded-[20px] bg-stone p-5.5 sm:contents">
            <blockquote className="sm:border-l-2 sm:border-clay sm:py-0.5 sm:pl-5">
              <p
                data-motion="words"
                className="text-lg leading-6.75 font-medium text-pine sm:leading-[1.55] sm:font-normal sm:text-clay"
              >
                {quote}
              </p>
            </blockquote>

            <div
              data-motion="rise"
              className="flex flex-col items-start sm:flex-row sm:flex-wrap sm:items-center sm:gap-3.5"
            >
              <div className="flex items-center gap-3">
                <span className="hidden sm:flex">
                  <LogoMark
                    logo={logo}
                    className="size-14"
                    badgeClassName="size-12"
                  />
                </span>
                <span className="text-[17px] leading-6 font-semibold text-clay sm:font-display sm:text-2xl sm:leading-[1.5] sm:text-forest sm:[font-variation-settings:'SOFT'_0,'WONK'_1]">
                  {siteName}
                </span>
              </div>
              <span
                aria-hidden
                className="hidden h-5.5 w-px bg-[#cfcfcf] sm:block"
              />
              <span className="text-[13px] leading-4.75 text-[#686561] sm:text-base sm:leading-[1.5] sm:text-text-muted">
                {role}
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
