"use client"

import Image from "next/image"
import { Suspense, useDeferredValue, useMemo, useRef } from "react"
import { useLenis } from "lenis/react"
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"

import { Container } from "@/components/layout/container"
import { gsap, useGSAP } from "@/lib/gsap"
import { cn, slugify } from "@/lib/utils"
import {
  ARTICLES,
  CATEGORIES,
  PAGE_SIZE,
  type Category,
} from "../data/articles"
import { ArticleCard } from "./article-card"

const ALL = "All articles" as const
const FILTERS: (Category | typeof ALL)[] = [ALL, ...CATEGORIES]

// Categories travel in the URL as slugs: "Anxiety & Stress" → anxiety-stress.
const BY_SLUG = new Map(CATEGORIES.map((c) => [slugify(c), c]))

// Filters, search and page live in the query string (?category=sleep&q=calm
// &page=2), so a filtered view can be shared, survives a refresh and comes
// back when the reader returns from an article. Defaults stay out of the URL.
const PARAMS = {
  category: parseAsStringLiteral([...BY_SLUG.keys()]),
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
}

type State = { category: string | null; q: string; page: number }
// null clears a key back to its default (and out of the URL).
type Patch = { [K in keyof State]?: State[K] | null }
type Update = (next: Patch, history?: "push" | "replace") => void

const DEFAULTS: State = { category: null, q: "", page: 1 }

function useBrowserState(): [State, Update] {
  const [state, setState] = useQueryStates(PARAMS, { scroll: false })
  const update: Update = (next, history = "push") => {
    void setState(next, { history })
  }
  return [state, update]
}

const matches = (query: string, ...fields: string[]) =>
  fields.some((field) => field.toLowerCase().includes(query))

// Reading the URL opts a prerendered page out of static HTML up to the nearest
// Suspense boundary, so only the two URL-driven parts sit behind one. Each
// prerenders in its default state (all articles, page one) and picks up the
// URL on load; headings and the featured story stay static around them, which
// keeps their scroll reveals bound to markup that never gets swapped out.
function UrlBound({
  view: View,
}: {
  view: React.ComponentType<{ state: State; update: Update }>
}) {
  const [state, update] = useBrowserState()
  return <View state={state} update={update} />
}

function withUrl(View: React.ComponentType<{ state: State; update: Update }>) {
  return (
    <Suspense fallback={<View state={DEFAULTS} update={() => {}} />}>
      <UrlBound view={View} />
    </Suspense>
  )
}

// The filter bar sits above the featured story (passed in from the server)
// and drives the latest-articles grid below it: category chips, a live search
// and pagination. Cards ease in whenever the visible set changes.
export function InsightsBrowser({ featured }: { featured: React.ReactNode }) {
  return (
    <>
      <section
        aria-label="Featured article"
        className="bg-white pt-12 pb-20 lg:pt-20 lg:pb-30"
      >
        <Container className="flex flex-col gap-14">
          {withUrl(FilterBar)}
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
            {withUrl(Count)}
          </div>
          {withUrl(Results)}
        </Container>
      </section>
    </>
  )
}

function FilterBar({ state, update }: { state: State; update: Update }) {
  const active = state.category ? BY_SLUG.get(state.category) : ALL

  return (
    <div className="flex flex-col gap-5 border-b border-[#e7e9e0] pb-7 lg:flex-row lg:items-center lg:justify-between">
      <div
        role="group"
        aria-label="Filter by category"
        className="-mx-4 flex [scrollbar-width:none] gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {FILTERS.map((item) => {
          const selected = item === active
          return (
            <button
              key={item}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                update({
                  category: item === ALL ? null : slugify(item),
                  page: null,
                })
              }
              className={cn(
                "shrink-0 cursor-pointer rounded-full px-4.5 py-2.5 text-base leading-[1.5] font-medium whitespace-nowrap transition-colors duration-300 outline-none focus-visible:ring-3 focus-visible:ring-clay/50",
                selected
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
          value={state.q}
          // Each keystroke replaces the entry, so Back skips past the typing.
          onChange={(event) =>
            update({ q: event.target.value || null, page: null }, "replace")
          }
          placeholder="Search articles"
          className="w-full bg-transparent text-base leading-[1.5] text-ink outline-none placeholder:text-[#8a8f88] lg:w-42.5"
        />
      </label>
    </div>
  )
}

function useResults(state: State) {
  const category = state.category ? BY_SLUG.get(state.category) : undefined
  const deferredQuery = useDeferredValue(state.q.trim().toLowerCase())

  const filtered = useMemo(
    () =>
      ARTICLES.filter(
        (article) =>
          (!category || article.category === category) &&
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
  const current = Math.min(Math.max(1, state.page), pages)
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const key = `${category}|${deferredQuery}|${current}`

  return { filtered, pages, current, visible, key }
}

function Count({ state }: { state: State; update: Update }) {
  const { filtered, visible } = useResults(state)
  return (
    <p aria-live="polite" className="text-base leading-[1.5] text-[#525252]">
      Showing {visible.length} of {filtered.length}
    </p>
  )
}

function Results({ state, update }: { state: State; update: Update }) {
  const { pages, current, visible, key } = useResults(state)
  const grid = useRef<HTMLDivElement>(null)
  const lenis = useLenis()

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

  const goTo = (next: number) => {
    update({ page: next })
    if (grid.current)
      lenis?.scrollTo(grid.current, { offset: -160, duration: 1 })
  }

  const clear = () => update({ category: null, q: null, page: null })

  return (
    <>
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
              onClick={clear}
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
          : "bg-stone text-ink-muted enabled:hover:bg-mist"
      )}
    >
      {children}
    </button>
  )
}
