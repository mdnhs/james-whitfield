import Link from "next/link"

import { MediaImage } from "@/components/media-image"
import type { ArticleSummary } from "@/lib/content/types"

export function PostCard({ article }: { article: ArticleSummary }) {
  const { slug, title, excerpt, image, author, date } = article
  const category = article.category.name
  const href = `/insights/${slug}`

  return (
    <article
      data-motion="deal"
      className="group relative flex flex-col gap-3.5 text-forest sm:gap-6"
    >
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        data-motion="tilt"
        className="relative block h-45 overflow-clip rounded-[18px] bg-[#e5e5e5] sm:h-58.5 sm:rounded-xl"
      >
        {/* Oversized frame gives the scroll parallax room to drift. */}
        <div
          data-motion="parallax"
          className="absolute inset-x-0 -inset-y-[8%]"
        >
          <MediaImage
            media={image}
            alt=""
            fill
            sizes="(min-width: 1024px) 420px, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      </Link>

      <div className="flex flex-col items-start">
        {/* Mobile: the tag sits on the image's top-left corner. */}
        <span className="absolute top-3 left-3 rounded-full bg-pine px-2.5 py-1.25 font-plex-mono text-xs leading-4 font-medium tracking-[1px] whitespace-nowrap text-white uppercase sm:static sm:mt-px sm:bg-brand sm:px-3 sm:py-1.5 sm:font-dm-mono sm:text-sm sm:leading-5.25 sm:font-normal sm:tracking-normal">
          {category}
        </span>

        <h3 className="text-xl leading-6.5 font-semibold tracking-[-0.2px] sm:pt-3 sm:text-[28.1px] sm:leading-[40.63px] sm:font-normal sm:tracking-normal lg:whitespace-pre-line">
          <Link
            href={href}
            className="hover:underline hover:underline-offset-4"
          >
            {title}
          </Link>
        </h3>

        <p className="line-clamp-3 pt-1.5 text-[15px] leading-5.75 text-[#686561] sm:line-clamp-none sm:pt-3 sm:text-base sm:leading-6 sm:text-forest">
          {excerpt}
        </p>

        <div className="flex items-center gap-2 pt-3.5 text-[13px] leading-4.75 whitespace-nowrap text-[#686561] sm:pt-4.5 sm:text-base sm:leading-6 sm:text-forest">
          {author.avatar && (
            <MediaImage
              media={author.avatar}
              alt=""
              width={32}
              height={32}
              className="size-6 rounded-full object-cover sm:size-8"
            />
          )}
          <span>{author.name}</span>
          <span
            aria-hidden
            className="size-0.75 rounded-full bg-current sm:size-1.25"
          />
          <time dateTime={date.iso}>{date.label}</time>
        </div>
      </div>
    </article>
  )
}
