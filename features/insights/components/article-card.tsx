import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"
import type { Article } from "../data/articles"

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
}: Pick<Article, "author" | "date"> & { size?: number }) {
  return (
    <p className="flex items-center gap-2 text-sm leading-[1.5] whitespace-pre text-ink-muted">
      <Image
        src={author.avatar}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full"
      />
      <span>
        {author.name}
        {"  •  "}
        <time dateTime={date.iso}>{date.label}</time>
      </span>
    </p>
  )
}

export function ArticleCard({ article }: { article: Article }) {
  const { slug, category, title, excerpt, image, author, date } = article

  return (
    <article
      data-article
      className="group relative flex flex-col items-start gap-5"
    >
      <div className="relative h-62.5 w-full overflow-clip rounded-2xl bg-mist">
        <Image
          src={image}
          alt=""
          fill
          sizes="(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      </div>
      <CategoryTag>{category}</CategoryTag>
      <div className="flex flex-col gap-2.5">
        <h3 className="text-2xl leading-[1.36] font-medium tracking-[-0.48px] text-ink">
          {/* The link covers the card so the whole tile is clickable. */}
          <Link
            href={`/insights/${slug}`}
            className="outline-none group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-clay/50"
          >
            {title}
          </Link>
        </h3>
        <p className="text-base leading-[1.5] tracking-[-0.32px] text-[#525252]">
          {excerpt}
        </p>
      </div>
      <Byline author={author} date={date} />
    </article>
  )
}
