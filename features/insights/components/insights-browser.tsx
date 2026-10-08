"use client"

import Image from "next/image"
import { useDeferredValue, useMemo, useRef, useState } from "react"
import { useLenis } from "lenis/react"

import { Container } from "@/components/layout/container"
import { gsap, useGSAP } from "@/lib/gsap"
import { cn } from "@/lib/utils"
import {
  ARTICLES,
  CATEGORIES,
  PAGE_SIZE,
  type Category,
} from "../data/articles"
import { ArticleCard } from "./article-card"

const ALL = "All articles" as const
const FILTERS: (Category | typeof ALL)[] = [ALL, ...CATEGORIES]

const matches = (query: string, ...fields: string[]) =>
  fields.some((field) => field.toLowerCase().includes(query))

// The filter bar sits above the featured story (passed in from the server)
// and drives the latest-articles grid below it: category chips, a live search
// and pagination. Cards ease in whenever the visible set changes.
export function InsightsBrowser({ featured }: { featured: React.ReactNode }) {
  const [category, setCategory] = useState<Category | typeof ALL>(ALL)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const grid = useRef<HTMLDivElement>(null)
  const lenis = useLenis()

  const filtered = useMemo(
    () =>
      ARTICLES.filter(
        (article) =>
          (category === ALL || article.category === category) &&
          (!deferredQuery ||
            matches(
              deferredQuery,
              article.title,
              article.excerpt,
              article.category
            ))
      ),
    [category, deferredQuery]
  )

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const key = `${category}|${deferredQuery}|${current}`

  // First pass reveals the grid as it scrolls in; later passes (filter, search,
  // page) settle the new cards in place straight away.
  const revealed = useRef(false)
  useGSAP(
    () => {
      const cards = grid.current?.querySelectorAll("[data-article]")
      if (!cards?.length) return
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
      const from = { autoAlpha: 0, y: 32 }
      const to = {
        autoAlpha: 1,
        y: 0,
        duration: 0.8,
        ease: "power2.out",
        stagger: 0.08,
        clearProps: "transform",
      }
      if (revealed.current) {
        gsap.fromTo(cards, from, to)
      } else {
        revealed.current = true
        gsap.fromTo(cards, from, {
          ...to,
          scrollTrigger: {
            trigger: grid.current,
            start: "top 85%",
            once: true,
          },
        })
      }
    },
    { dependencies: [key], scope: grid }
  )

  const choose = (next: Category | typeof ALL) => {
    setCategory(next)
    setPage(1)
  }

  const goTo = (next: number) => {
    setPage(next)
    if (grid.current)
      lenis?.scrollTo(grid.current, { offset: -160, duration: 1 })
  }

  return (
    <>
      <section
        aria-label="Featured article"
        className="bg-white pt-12 pb-20 lg:pt-20 lg:pb-30"
      >
        <Container className="flex flex-col gap-14">
          <div className="flex flex-col gap-5 border-b border-[#e7e9e0] pb-7 lg:flex-row lg:items-center lg:justify-between">
            <div
              role="group"
              aria-label="Filter by category"
              className="-mx-4 flex [scrollbar-width:none] gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
            >
              {FILTERS.map((item) => {
                const active = item === category
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    onClick={() => choose(item)}
                    className={cn(
                      "shrink-0 cursor-pointer rounded-full px-4.5 py-2.5 text-base leading-[1.5] font-medium whitespace-nowrap transition-colors duration-300 outline-none focus-visible:ring-3 focus-visible:ring-clay/50",
                      active
                        ? "bg-pine text-cream"
                        : "bg-stone text-ink-muted hover:bg-mist"
                    )}
                  >
                    {item}
                  </button>
                )
              })}
            </div>

            <label className="flex shrink-0 items-center gap-2 rounded-full border border-[#dfe2d8] px-4.5 py-2.75 transition-colors focus-within:border-pine/50">
              <Image
                src="/images/insights/icon-search.svg"
                alt=""
                width={24}
                height={24}
              />
              <span className="sr-only">Search articles</span>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="Search articles"
                className="w-full bg-transparent text-base leading-[1.5] text-ink outline-none placeholder:text-[#8a8f88] lg:w-42.5"
              />
            </label>
          </div>

          {featured}
        </Container>
      </section>

      <section
        aria-labelledby="latest-heading"
        className="bg-stone py-20 lg:py-30"
      >
        <Container className="flex flex-col gap-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2
              id="latest-heading"
              data-motion="words"
              className="font-display text-[38px] leading-[1.3] font-bold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
            >
              Latest articles
            </h2>
            <p
              aria-live="polite"
              className="text-base leading-[1.5] text-[#525252]"
            >
              Showing {visible.length} of {filtered.length}
            </p>
          </div>

          <div ref={grid}>
            {visible.length ? (
              <div className="grid grid-cols-1 gap-x-7 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
                {visible.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center">
                <p className="text-lg text-ink-muted">
                  No articles match that yet.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("")
                    choose(ALL)
                  }}
                  className="cursor-pointer text-[15px] font-semibold text-clay hover:underline hover:underline-offset-4"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {pages > 1 && (
            <nav aria-label="Pagination" className="flex justify-center">
              <ol className="flex items-center gap-2.5">
                <li>
                  <PageButton
                    label="Previous page"
                    disabled={current === 1}
                    onClick={() => goTo(current - 1)}
                  >
                    ←
                  </PageButton>
                </li>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <li key={n}>
                    <PageButton
                      label={`Page ${n}`}
                      active={n === current}
                      onClick={() => goTo(n)}
                    >
                      {n}
                    </PageButton>
                  </li>
                ))}
                <li>
                  <PageButton
                    label="Next page"
                    disabled={current === pages}
                    onClick={() => goTo(current + 1)}
                  >
                    →
                  </PageButton>
                </li>
              </ol>
            </nav>
          )}
        </Container>
      </section>
    </>
  )
}

function PageButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-11 cursor-pointer items-center justify-center rounded-full text-[15px] leading-[1.5] font-medium transition-colors duration-300 outline-none focus-visible:ring-3 focus-visible:ring-clay/50 disabled:cursor-default disabled:opacity-40",
        active
          ? "bg-pine text-cream"
          : "bg-white text-ink-muted enabled:hover:bg-mist"
      )}
    >
      {children}
    </button>
  )
}
