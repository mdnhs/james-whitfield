import type { Mark as PmMark, Node as PmNode } from "@tiptap/pm/model"
import { renderToReactElement } from "@tiptap/static-renderer/pm/react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Href } from "@/blocks/fields"
import type { ArticleBodyDoc, RichTextDoc } from "@/blocks/rich-text"
import { MediaImage } from "@/components/media-image"
import type { MediaAsset } from "@/lib/media"
import { articleExtensions } from "@/lib/rich-text/extensions"

type NodeProps = { node: PmNode; parent?: PmNode; children?: ReactNode }
type MarkProps = { mark: PmMark; children?: ReactNode }

const DISPLAY = "[font-variation-settings:'SOFT'_0,'WONK'_1]"

// The Phase 3 markup, node for node (tests/content/__snapshots__/seed): the
// first top-level paragraph is the lead; list items are a bullet + a span
// of inline text; quotes are clay-ruled display paragraphs.
function nodeMapping(media: ReadonlyMap<string, MediaAsset>) {
  return {
    paragraph: ({ node, parent, children }: NodeProps) => {
      const within = parent?.type.name
      if (within === "listItem") return <>{children}</>
      if (within === "blockquote")
        return (
          <p
            data-motion="words"
            className={`font-display text-[24px] leading-[1.35] font-semibold text-pine ${DISPLAY} sm:text-[30px]`}
          >
            {children}
          </p>
        )
      if (within === "doc" && parent?.firstChild === node)
        return (
          <p
            data-motion="words"
            className="pb-2 text-[21px] leading-[1.6] text-ink sm:text-[23px]"
          >
            {children}
          </p>
        )
      return <p data-motion="rise">{children}</p>
    },
    heading: ({ node, children }: NodeProps) =>
      node.attrs.level === 3 ? (
        <h3
          data-motion="words"
          className="pt-4 text-[21px] leading-[1.3] font-semibold text-ink sm:text-[24px]"
        >
          {children}
        </h3>
      ) : (
        <h2
          data-motion="words"
          className="pt-6 text-[26px] leading-[1.25] font-semibold tracking-[-0.5px] text-ink sm:text-[32px]"
        >
          {children}
        </h2>
      ),
    blockquote: ({ children }: NodeProps) => (
      <blockquote className="relative my-4 py-1 pl-6 sm:pl-8">
        <span
          aria-hidden
          data-motion="grow"
          className="absolute inset-y-0 left-0 w-0.5 bg-clay"
        />
        {children}
      </blockquote>
    ),
    bulletList: ({ children }: NodeProps) => (
      <ul data-motion="stagger" className="flex flex-col gap-4">
        {children}
      </ul>
    ),
    listItem: ({ children }: NodeProps) => (
      <li className="flex gap-4">
        <span
          aria-hidden
          className="mt-2.75 size-1.5 shrink-0 rounded-full bg-clay"
        />
        <span>{children}</span>
      </li>
    ),
    image: ({ node }: NodeProps) => {
      const asset = media.get(node.attrs.mediaId as string)
      if (!asset) return null
      return (
        <figure data-motion="rise" className="my-4 overflow-hidden rounded-3xl">
          <MediaImage
            media={asset}
            sizes="(min-width: 1024px) 720px, 100vw"
            className="h-auto w-full object-cover"
          />
        </figure>
      )
    },
  }
}

// A link whose href fails the editor's rules (blocks/fields Href) renders as
// plain text. Text is a React child, so it is always escaped.
const markMapping = {
  bold: ({ children }: MarkProps) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  italic: ({ children }: MarkProps) => <em>{children}</em>,
  link: ({ mark, children }: MarkProps) => {
    const href = Href.safeParse(mark.attrs.href)
    return href.success ? (
      <Link href={href.data} className="text-clay underline underline-offset-4">
        {children}
      </Link>
    ) : (
      <>{children}</>
    )
  },
}

export function RichText({
  doc,
  media = [],
}: {
  doc: RichTextDoc | ArticleBodyDoc
  media?: readonly MediaAsset[]
}) {
  try {
    return renderToReactElement({
      content: doc,
      extensions: articleExtensions,
      options: {
        nodeMapping: nodeMapping(
          new Map(media.flatMap((m) => (m.id ? [[m.id, m] as const] : [])))
        ),
        markMapping,
        // A hand-edited or future node type renders nothing; its siblings stay.
        unhandledNode: () => null,
        unhandledMark: ({ children }: MarkProps) => <>{children}</>,
      },
    })
  } catch (error) {
    // Bodies are validated on publish; a hand-edited row must not take the
    // whole article down.
    console.warn("[content] rich text could not be rendered", error)
    return null
  }
}
