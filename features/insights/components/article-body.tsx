import Link from "next/link"

import { Container } from "@/components/layout/container"
import { MediaImage } from "@/components/media-image"
import { buttonVariants } from "@/components/ui/button"
import type { GlobalValue } from "@/lib/content/globals"
import type { ArticleDetail } from "@/lib/content/types"
import { cn } from "@/lib/utils"
import { RichText } from "./rich-text"
import { ShareLinks } from "./share-links"

// The reading column, with the author and share controls in a rail that stays
// in view beside it on desktop and follows the article on smaller screens.
export function ArticleBody({
  article,
  copy,
  ctaHref,
}: {
  article: ArticleDetail
  copy: GlobalValue<"microcopy">
  ctaHref: string
}) {
  const { author, title } = article

  return (
    <section
      aria-label={copy.articleChapters.article}
      className="bg-white py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-16 lg:flex-row lg:items-start lg:gap-16 xl:gap-28">
        <aside className="order-last flex shrink-0 flex-col gap-8 border-t border-line-soft pt-10 lg:sticky lg:top-28 lg:order-first lg:w-60 lg:border-0 lg:pt-2">
          <div data-motion="rise" className="flex items-center gap-3">
            {author.avatar && (
              <MediaImage
                media={author.avatar}
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-full object-cover"
              />
            )}
            <div className="flex flex-col">
              <span className="text-xs leading-[1.5] tracking-[0.08em] text-text-subtle uppercase">
                {copy.writtenBy}
              </span>
              <span className="font-display text-xl leading-[1.3] font-semibold text-forest [font-variation-settings:'SOFT'_0,'WONK'_1]">
                {author.name}
              </span>
            </div>
          </div>
          <div data-motion="rise" className="flex flex-col gap-3">
            <span className="text-xs leading-[1.5] tracking-[0.08em] text-text-subtle uppercase">
              {copy.share}
            </span>
            <ShareLinks title={title} copy={copy} />
          </div>
          <Link
            href="/insights"
            data-motion="rise"
            className="self-start text-[15px] font-semibold text-clay hover:underline hover:underline-offset-4"
          >
            {copy.allInsights}
          </Link>
        </aside>

        <div className="flex max-w-180 min-w-0 flex-1 flex-col gap-6 text-[17px] leading-[1.75] text-ink-muted">
          <RichText doc={article.body} media={article.media} />

          <div
            data-motion="rise"
            className="mt-10 flex flex-col items-start gap-5 rounded-3xl bg-stone p-8 sm:p-10"
          >
            <h2 className="font-display text-[28px] leading-[1.2] font-semibold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[34px]">
              {copy.articleCta.title}
            </h2>
            <p className="text-base leading-[1.6] text-ink-muted">
              {copy.articleCta.body}
            </p>
            <Link
              href={ctaHref}
              data-magnetic
              className={cn(
                buttonVariants(),
                "h-auto w-full rounded-full bg-clay px-7 py-4 text-[15px] leading-[normal] font-semibold text-cream hover:bg-clay/90 sm:w-auto"
              )}
            >
              {copy.articleCta.button}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  )
}
