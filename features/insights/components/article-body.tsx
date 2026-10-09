import Image from "next/image"
import Link from "next/link"

import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { contactHref } from "@/features/contact/data/contact-params"
import { cn } from "@/lib/utils"
import type { Block } from "../data/article-bodies"
import type { Article, Category } from "../data/articles"
import { ShareLinks } from "./share-links"

// "Lower the stakes. Shrink the next step…" sets its opening sentence in bold
// so list items scan as headed steps. Single-sentence items stay plain.
function ListItem({ text }: { text: string }) {
  const cut = text.indexOf(". ")
  if (cut === -1) return <>{text}</>
  return (
    <>
      <strong className="font-semibold text-ink">
        {text.slice(0, cut + 1)}
      </strong>
      {text.slice(cut + 1)}
    </>
  )
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "h2":
      return (
        <h2
          data-motion="words"
          className="pt-6 text-[26px] leading-[1.25] font-semibold tracking-[-0.5px] text-ink sm:text-[32px]"
        >
          {block.text}
        </h2>
      )
    case "quote":
      return (
        <blockquote className="relative my-4 py-1 pl-6 sm:pl-8">
          <span
            aria-hidden
            data-motion="grow"
            className="absolute inset-y-0 left-0 w-0.5 bg-clay"
          />
          <p
            data-motion="words"
            className="font-display text-[24px] leading-[1.35] font-semibold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[30px]"
          >
            {block.text}
          </p>
        </blockquote>
      )
    case "list":
      return (
        <ul data-motion="stagger" className="flex flex-col gap-4">
          {block.items.map((item) => (
            <li key={item} className="flex gap-4">
              <span
                aria-hidden
                className="mt-2.75 size-1.5 shrink-0 rounded-full bg-clay"
              />
              <span>
                <ListItem text={item} />
              </span>
            </li>
          ))}
        </ul>
      )
    default:
      return <p data-motion="rise">{block.text}</p>
  }
}

// The closing call to action opens the contact form on the matching service.
const TOPIC_FOR: Partial<Record<Category, string>> = {
  "Anxiety & Stress": "anxiety-stress",
  Leadership: "performance-leadership",
  Sleep: "sleep-rest",
}

// The reading column, with the author and share controls in a rail that stays
// in view beside it on desktop and follows the article on smaller screens.
export function ArticleBody({
  article,
  blocks,
}: {
  article: Article
  blocks: Block[]
}) {
  const [lead, ...rest] = blocks
  const { author, title } = article

  return (
    <section aria-label="Article" className="bg-white py-20 lg:py-30">
      <Container className="flex flex-col gap-16 lg:flex-row lg:items-start lg:gap-16 xl:gap-28">
        <aside className="order-last flex shrink-0 flex-col gap-8 border-t border-[#e7e9e0] pt-10 lg:sticky lg:top-28 lg:order-first lg:w-60 lg:border-0 lg:pt-2">
          <div data-motion="rise" className="flex items-center gap-3">
            <Image
              src={author.avatar}
              alt=""
              width={48}
              height={48}
              className="size-12 shrink-0 rounded-full object-cover"
            />
            <div className="flex flex-col">
              <span className="text-xs leading-[1.5] tracking-[0.08em] text-[#8a8f88] uppercase">
                Written by
              </span>
              <span className="font-display text-xl leading-[1.3] font-semibold text-forest [font-variation-settings:'SOFT'_0,'WONK'_1]">
                {author.name}
              </span>
            </div>
          </div>
          <div data-motion="rise" className="flex flex-col gap-3">
            <span className="text-xs leading-[1.5] tracking-[0.08em] text-[#8a8f88] uppercase">
              Share
            </span>
            <ShareLinks title={title} />
          </div>
          <Link
            href="/insights"
            data-motion="rise"
            className="self-start text-[15px] font-semibold text-clay hover:underline hover:underline-offset-4"
          >
            ← All insights
          </Link>
        </aside>

        <div className="flex max-w-180 min-w-0 flex-1 flex-col gap-6 text-[17px] leading-[1.75] text-ink-muted">
          {lead && lead.type === "p" && (
            <p
              data-motion="words"
              className="pb-2 text-[21px] leading-[1.6] text-ink sm:text-[23px]"
            >
              {lead.text}
            </p>
          )}
          {rest.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}

          <div
            data-motion="rise"
            className="mt-10 flex flex-col items-start gap-5 rounded-3xl bg-stone p-8 sm:p-10"
          >
            <h2 className="font-display text-[28px] leading-[1.2] font-semibold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[34px]">
              Ready to talk it through?
            </h2>
            <p className="text-base leading-[1.6] text-ink-muted">
              A free, no-pressure discovery call is the easiest first step. We
              will talk about what is going on and whether working together is
              the right fit.
            </p>
            <Link
              href={contactHref({
                plan: "discovery-call",
                topic: TOPIC_FOR[article.category],
              })}
              data-magnetic
              className={cn(
                buttonVariants(),
                "h-auto rounded-full bg-clay px-7 py-4 text-[15px] leading-[normal] font-semibold text-cream hover:bg-clay/90"
              )}
            >
              Book a discovery call →
            </Link>
          </div>
        </div>
      </Container>
    </section>
  )
}
