import Image from "next/image"
import Link from "next/link"

import { Container } from "@/components/layout/container"
import type { Article } from "../data/articles"
import { CategoryTag } from "./article-card"

// Opening frame of an article: the cover photo full bleed under a dark
// gradient, breadcrumb back to Insights, then category, title and byline. The
// fixed site header overlays its top; the photo drifts as the frame scrolls.
export function ArticleHero({
  article,
  readTime,
}: {
  article: Article
  readTime: string
}) {
  const { title, category, image, author, date } = article

  return (
    <section
      aria-labelledby="article-heading"
      className="relative flex min-h-svh w-full flex-col overflow-clip bg-[#0d120f] lg:min-h-190"
    >
      <div aria-hidden className="absolute inset-0">
        <div
          data-motion="parallax"
          className="absolute inset-x-0 -inset-y-[8%]"
        >
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,18,15,0.55)_0%,rgba(8,18,15,0.2)_35%,rgba(8,23,20,0.92)_100%)]" />
      </div>

      <Container className="relative flex flex-1 flex-col justify-end gap-8 pt-36 pb-14 lg:pb-18">
        <nav
          aria-label="Breadcrumb"
          data-motion="rise"
          className="inline-flex max-w-full items-center gap-2.25 self-start overflow-hidden rounded-full border border-white/10 bg-[rgba(231,239,238,0.05)] py-2.25 pr-4 pl-3.5 text-sm leading-[1.5] backdrop-blur-sm"
        >
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-white"
          />
          <Link
            href="/"
            className="text-white/70 transition-colors hover:text-white"
          >
            Home
          </Link>
          <span aria-hidden className="text-white/40">
            /
          </span>
          <Link
            href="/insights"
            className="text-white/70 transition-colors hover:text-white"
          >
            Insights
          </Link>
          <span aria-hidden className="text-white/40">
            /
          </span>
          <span aria-current="page" className="truncate font-medium text-white">
            {category}
          </span>
        </nav>

        <div className="flex max-w-260 flex-col gap-6">
          <div data-motion="rise" className="flex items-center gap-3">
            <CategoryTag className="h-7 px-3">{category}</CategoryTag>
            <span className="text-sm leading-[1.5] text-white/75">
              {readTime}
            </span>
          </div>
          <h1
            id="article-heading"
            data-motion="rise"
            data-delay="0.1"
            className="font-display text-[40px] leading-[1.1] font-semibold text-white [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[56px] xl:text-[72px]"
          >
            {title}
          </h1>
        </div>

        <div
          data-motion="rise"
          data-delay="0.2"
          className="flex items-center gap-3 border-t border-white/15 pt-6 text-[15px] leading-[1.5] text-white/80"
        >
          <Image
            src={author.avatar}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-full object-cover"
          />
          <span className="font-medium text-white">{author.name}</span>
          <span aria-hidden className="size-1 rounded-full bg-white/50" />
          <time dateTime={date.iso}>{date.label}</time>
        </div>
      </Container>
    </section>
  )
}
