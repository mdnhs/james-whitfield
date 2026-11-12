import Link from "next/link"

import { MediaImage } from "@/components/media-image"
import { categoryHref } from "@/lib/content/taxonomy"
import type { ArticleSummary } from "@/lib/content/types"
import { cn } from "@/lib/utils"

export function CategoryTag({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center rounded-full bg-brand-deep px-4 text-sm leading-[1.5] font-medium whitespace-nowrap text-cream uppercase",
        className
      )}
    >
      {children}
    </span>
  )
}

export function Byline({
  author,
  date,
  size = 28,
  compact = false,
  stacked = false,
}: Pick<ArticleSummary, "author" | "date"> & {
  size?: number
  // Phones: text only, at caption size (the list rows).
  compact?: boolean
  // Phones: name over date, so the line can sit beside a button.
  stacked?: boolean
}) {
  if (stacked)
    return (
      <p className="flex min-w-0 items-center gap-2.5 text-sm leading-[1.5] text-ink-muted sm:gap-2 sm:whitespace-pre">
        {author.avatar && (
          <MediaImage
            media={author.avatar}
            alt=""
            width={size}
            height={size}
            className="size-8 shrink-0 rounded-full sm:size-auto"
          />
        )}
        <span className="flex min-w-0 flex-col text-[13px] leading-4.75 sm:block sm:text-sm sm:leading-[1.5]">
          <span className="truncate font-semibold text-ink sm:font-normal sm:text-ink-muted">
            {author.name}
          </span>
          <span aria-hidden className="hidden sm:inline">
            {"  •  "}
          </span>
          <time
            dateTime={date.iso}
            className="text-[#686561] sm:text-ink-muted"
          >
            {date.label}
          </time>
        </span>
      </p>
    )

  return (
    <p
      className={cn(
        "flex items-center gap-2 whitespace-pre",
        compact
          ? "text-[13px] leading-4.75 text-[#686561] sm:text-sm sm:leading-[1.5] sm:text-ink-muted"
          : "text-sm leading-[1.5] text-ink-muted"
      )}
    >
      {author.avatar && (
        <MediaImage
          media={author.avatar}
          alt=""
          width={size}
          height={size}
          className={cn("shrink-0 rounded-full", compact && "hidden sm:block")}
        />
      )}
      <span>
        {author.name}
        {"  •  "}
        <time dateTime={date.iso}>{date.label}</time>
      </span>
    </p>
  )
}

export function ArticleCard({ article }: { article: ArticleSummary }) {
  const { slug, title, excerpt, image, author, date } = article
  const category = article.category

  return (
    <article
      data-article
      // Phones: a compact row (thumbnail beside the copy) on a white card;
      // sm+: the stacked card. The copy wrapper dissolves (contents) on sm+.
      className="group relative flex items-center gap-3.5 rounded-[18px] bg-white p-2.5 sm:flex-col sm:items-start sm:gap-5 sm:rounded-none sm:bg-transparent sm:p-0"
    >
      <div className="relative size-24 shrink-0 overflow-clip rounded-[14px] bg-mist sm:h-62.5 sm:w-full sm:rounded-2xl">
        <MediaImage
          media={image}
          alt=""
          fill
          sizes="(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1 sm:contents">
        {/* Above the title link's card-wide overlay, so it stays clickable. */}
        <Link
          href={categoryHref(category.slug)}
          className="relative z-10 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-clay/50"
        >
          <CategoryTag className="h-auto bg-transparent px-0 font-plex-mono text-xs leading-4 font-medium tracking-[1px] text-clay sm:h-8 sm:bg-brand-deep sm:px-4 sm:font-sans sm:text-sm sm:leading-[1.5] sm:tracking-normal sm:text-cream">
            {category.name}
          </CategoryTag>
        </Link>
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[17px] leading-6 font-semibold text-forest sm:text-2xl sm:leading-[1.36] sm:font-medium sm:tracking-[-0.48px] sm:text-ink">
            {/* The link covers the card so the whole tile is clickable. */}
            <Link
              href={`/insights/${slug}`}
              className="outline-none group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-clay/50"
            >
              {title}
            </Link>
          </h3>
          <p className="hidden text-base leading-[1.5] tracking-[-0.32px] text-text-muted sm:block">
            {excerpt}
          </p>
        </div>
        <Byline author={author} date={date} compact />
      </div>
    </article>
  )
}
