import Image from "next/image"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FEATURED_ARTICLE } from "../data/articles"
import { Byline, CategoryTag } from "./article-card"

export function FeaturedArticle() {
  const { slug, title, excerpt, image, author, date, readTime } =
    FEATURED_ARTICLE
  const href = `/insights/${slug}`

  return (
    <article className="group flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-10 xl:gap-14">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        data-motion="tilt"
        data-tilt="3"
        className="relative block h-80 shrink-0 overflow-clip rounded-3xl bg-mist sm:h-115 lg:w-[52%] xl:w-170"
      >
        <div
          data-motion="parallax"
          className="absolute inset-x-0 -inset-y-[8%]"
        >
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 680px, 100vw"
            style={{ objectPosition: "44% 0%" }}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col items-start gap-6">
        <div data-motion="rise" className="flex items-center gap-3">
          <CategoryTag className="h-7 px-3">Featured</CategoryTag>
          <span className="text-sm leading-[1.5] text-[#525252]">
            {readTime}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <h2
            data-motion="words"
            className="text-[30px] leading-[1.2] font-semibold tracking-[-0.6px] text-ink sm:text-[38px]"
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
            className="text-base leading-[1.61] tracking-[-0.16px] text-[#525252]"
          >
            {excerpt}
          </p>
        </div>
        <div data-motion="rise">
          <Byline author={author} date={date} size={36} />
        </div>
        <Link
          href={href}
          data-motion="rise"
          data-magnetic
          className={cn(
            buttonVariants(),
            "h-auto rounded-full bg-clay px-7 py-4 text-[15px] leading-[normal] font-semibold text-cream hover:bg-clay/90"
          )}
        >
          Read article →
        </Link>
      </div>
    </article>
  )
}
