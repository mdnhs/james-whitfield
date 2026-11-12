import Link from "next/link"

import { MediaImage } from "@/components/media-image"
import { buttonVariants } from "@/components/ui/button"
import type { GlobalValue } from "@/lib/content/globals"
import type { ArticleSummary } from "@/lib/content/types"
import { fill } from "@/lib/fill"
import { cn } from "@/lib/utils"
import { Byline, CategoryTag } from "./article-card"

export function FeaturedArticle({
  article,
  copy,
}: {
  article: ArticleSummary
  copy: GlobalValue<"microcopy">
}) {
  const { slug, title, excerpt, image, author, date } = article
  const href = `/insights/${slug}`

  return (
    <article className="group relative flex flex-col gap-4 sm:gap-10 lg:flex-row lg:items-center lg:gap-10 xl:gap-14">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        data-motion="tilt"
        data-tilt="3"
        className="relative block h-65 shrink-0 overflow-clip rounded-3xl bg-mist sm:h-115 lg:w-[52%] xl:w-170"
      >
        <div
          data-motion="parallax"
          className="absolute inset-x-0 -inset-y-[8%]"
        >
          <MediaImage
            media={image}
            fill
            priority
            sizes="(min-width: 1024px) 680px, 100vw"
            style={{ objectPosition: "44% 0%" }}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col items-start gap-4 sm:gap-6">
        {/* Phones: the tags sit on the photo's top-left corner. */}
        <div
          data-motion="rise"
          className="absolute top-3.5 left-3.5 flex items-center gap-2 sm:static sm:gap-3"
        >
          <CategoryTag className="h-auto bg-clay px-2.5 py-1.25 font-plex-mono text-xs leading-4 font-medium tracking-[1px] text-white sm:h-7 sm:bg-brand-deep sm:px-3 sm:py-0 sm:font-sans sm:text-sm sm:leading-[1.5] sm:tracking-normal sm:text-cream">
            {copy.featured}
          </CategoryTag>
          <span className="rounded-full bg-white px-2.5 py-1.25 font-plex-mono text-xs leading-4 font-medium tracking-[1px] text-pine uppercase sm:rounded-none sm:bg-transparent sm:p-0 sm:font-sans sm:text-sm sm:leading-[1.5] sm:font-normal sm:tracking-normal sm:text-text-muted sm:normal-case">
            {fill(copy.readTime, { minutes: article.readingMinutes })}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <h2
            data-motion="words"
            className="font-display text-[26px] leading-8 font-bold tracking-[-0.3px] text-forest [font-variation-settings:'SOFT'_0,'WONK'_1] sm:font-sans sm:text-[38px] sm:leading-[1.2] sm:font-semibold sm:tracking-[-0.6px] sm:text-ink sm:[font-variation-settings:normal]"
          >
            <Link
              href={href}
              className="hover:underline hover:decoration-2 hover:underline-offset-6"
            >
              {title}
            </Link>
          </h2>
          <p
            data-motion="rise"
            className="text-[15px] leading-5.75 text-ink-muted sm:text-base sm:leading-[1.61] sm:tracking-[-0.16px] sm:text-text-muted"
          >
            {excerpt}
          </p>
        </div>
        {/* Phones: byline and a small Read pill share one row. */}
        <div className="flex w-full items-center justify-between gap-3 sm:contents">
          <div data-motion="rise" className="min-w-0">
            <Byline author={author} date={date} size={36} stacked />
          </div>
          <Link
            href={href}
            data-motion="rise"
            data-magnetic
            className={cn(
              buttonVariants(),
              "h-auto shrink-0 rounded-full bg-pine px-4 py-2.5 text-[13px] leading-4.75 font-semibold text-white hover:bg-pine/90 sm:w-auto sm:bg-clay sm:px-7 sm:py-4 sm:text-[15px] sm:leading-[normal] sm:text-cream sm:hover:bg-clay/90"
            )}
          >
            {copy.readArticle}
          </Link>
        </div>
      </div>
    </article>
  )
}
