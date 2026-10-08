import Image from "next/image"
import Link from "next/link"

import type { Post } from "../data/posts"

export function PostCard({ post }: { post: Post }) {
  const { slug, category, title, excerpt, image, author, date } = post
  const href = `/insights/${slug}`

  return (
    <article
      data-motion="deal"
      className="group flex flex-col gap-6 text-forest"
    >
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        data-motion="tilt"
        className="relative block h-58.5 overflow-clip rounded-xl bg-[#e5e5e5]"
      >
        {/* Oversized frame gives the scroll parallax room to drift. */}
        <div
          data-motion="parallax"
          className="absolute inset-x-0 -inset-y-[8%]"
        >
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 1024px) 420px, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      </Link>

      <div className="flex flex-col items-start">
        <span className="mt-px rounded-full bg-brand px-3 py-1.5 font-dm-mono text-sm leading-5.25 whitespace-nowrap text-white uppercase">
          {category}
        </span>

        <h3 className="pt-3 text-[28.1px] leading-[40.63px] lg:whitespace-pre-line">
          <Link
            href={href}
            className="hover:underline hover:underline-offset-4"
          >
            {title}
          </Link>
        </h3>

        <p className="pt-3 text-base leading-6">{excerpt}</p>

        <div className="flex items-center gap-2 pt-4.5 text-base leading-6 whitespace-nowrap">
          <Image
            src={author.avatar}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full object-cover"
          />
          <span>{author.name}</span>
          <span aria-hidden className="size-1.25 rounded-full bg-forest" />
          <time dateTime={date.iso}>{date.label}</time>
        </div>
      </div>
    </article>
  )
}
