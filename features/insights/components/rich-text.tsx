import Link from "next/link"
import { Fragment, type ReactNode } from "react"

import { Href } from "@/blocks/fields"
import type {
  RichTextDoc,
  RichTextInline,
  RichTextNode,
} from "@/blocks/rich-text"

// Text runs render as fragments: a list item must stay `<strong>` followed by
// a bare text node, exactly as the old renderer wrote it. Text goes through
// React as a child, so it is always escaped. A link mark whose href fails the
// same rules the editor enforces (blocks/fields Href) renders as plain text.
function Inline({ nodes }: { nodes?: RichTextInline[] }) {
  return (nodes ?? []).map((n, i) => {
    let out: ReactNode = n.text
    for (const mark of n.marks ?? []) {
      if (mark.type === "bold") {
        out = <strong className="font-semibold text-ink">{out}</strong>
      }
      if (mark.type === "italic") out = <em>{out}</em>
      if (mark.type === "link") {
        const href = Href.safeParse(mark.attrs?.href)
        if (href.success) {
          out = (
            <Link
              href={href.data}
              className="text-clay underline underline-offset-4"
            >
              {out}
            </Link>
          )
        }
      }
    }
    return <Fragment key={i}>{out}</Fragment>
  })
}

// Same markup as the old article-body BlockView, node for node.
function Node({ node }: { node: RichTextNode }) {
  switch (node.type) {
    case "heading":
      return (
        <h2
          data-motion="words"
          className="pt-6 text-[26px] leading-[1.25] font-semibold tracking-[-0.5px] text-ink sm:text-[32px]"
        >
          <Inline nodes={node.content} />
        </h2>
      )
    case "blockquote":
      return (
        <blockquote className="relative my-4 py-1 pl-6 sm:pl-8">
          <span
            aria-hidden
            data-motion="grow"
            className="absolute inset-y-0 left-0 w-0.5 bg-clay"
          />
          {node.content.map((p, i) => (
            <p
              key={i}
              data-motion="words"
              className="font-display text-[24px] leading-[1.35] font-semibold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[30px]"
            >
              <Inline nodes={p.content} />
            </p>
          ))}
        </blockquote>
      )
    case "bulletList":
      return (
        <ul data-motion="stagger" className="flex flex-col gap-4">
          {node.content.map((item, i) => (
            <li key={i} className="flex gap-4">
              <span
                aria-hidden
                className="mt-2.75 size-1.5 shrink-0 rounded-full bg-clay"
              />
              <span>
                <Inline nodes={item.content[0].content} />
              </span>
            </li>
          ))}
        </ul>
      )
    case "paragraph":
      return (
        <p data-motion="rise">
          <Inline nodes={node.content} />
        </p>
      )
  }
}

// The first paragraph is the article's lead, as before.
export function RichText({ doc }: { doc: RichTextDoc }) {
  const [first, ...rest] = doc.content
  const lead = first?.type === "paragraph" ? first : null
  return (
    <>
      {lead && (
        <p
          data-motion="words"
          className="pb-2 text-[21px] leading-[1.6] text-ink sm:text-[23px]"
        >
          <Inline nodes={lead.content} />
        </p>
      )}
      {(lead ? rest : doc.content).map((node, i) => (
        <Node key={i} node={node} />
      ))}
    </>
  )
}
