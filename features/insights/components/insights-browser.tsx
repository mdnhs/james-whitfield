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

import type { BlockView } from "@/blocks/media-refs"
import { Container } from "@/components/layout/container"
import type { GlobalValue } from "@/lib/content/globals"
import type { ArticleSummary, CategoryView } from "@/lib/content/types"
import { fill } from "@/lib/fill"
import { gsap, useGSAP } from "@/lib/gsap"
import { cn } from "@/lib/utils"
import { ArticleCard } from "./article-card"

type State = { category: string | null; q: string; page: number }
// null clears a key back to its default (and out of the URL).
type Patch = { [K in keyof State]?: State[K] | null }
type Update = (next: Patch, history?: "push" | "replace") => void

const DEFAULTS: State = { category: null, q: "", page: 1 }

// Filters, search and page live in the query string (?category=sleep&q=calm
// &page=2), so a filtered view can be shared, survives a refresh and comes
// back when the reader returns from an article. Defaults stay out of the URL.
// Categories travel as slugs: "Anxiety & Stress" → anxiety-stress.
function buildParams(categories: CategoryView[]) {
  return {
    category: parseAsStringLiteral(categories.map((c) => c.slug)),
    q: parseAsString.withDefault(""),
    page: parseAsInteger.withDefault(1),
  }
}
type Params = ReturnType<typeof buildParams>

function useBrowserState(params: Params): [State, Update] {
  const [state, setState] = useQueryStates(params, { scroll: false })
  const update: Update = (next, history = "push") => {
    void setState(next, { history })
  }
  return [state, update]
}

const matches = (query: string, ...fields: string[]) =>
  fields.some((field) => field.toLowerCase().includes(query))

type Shared = {
  articles: ArticleSummary[]
  categories: CategoryView[]
  copy: GlobalValue<"microcopy">
  pageSize: number
  paging: BlockView<"insights.browser">["paging"]
}
type ViewProps = Shared & { state: State; update: Update }

// Reading the URL opts a prerendered page out of static HTML up to the nearest
// Suspense boundary, so only the two URL-driven parts sit behind one. Each
// prerenders in its default state (all articles, page one) and picks up the
// URL on load; headings and the featured story stay static around them, which
// keeps their scroll reveals bound to markup that never gets swapped out.
function UrlBound({
  view: View,
  params,
  shared,
}: {
  view: React.ComponentType<ViewProps>
  params: Params
  shared: Shared
}) {
  const [state, update] = useBrowserState(params)
  return <View {...shared} state={state} update={update} />
}

function withUrl(
  View: React.ComponentType<ViewProps>,
  params: Params,
  shared: Shared
) {
  return (
    <Suspense
      fallback={<View {...shared} state={DEFAULTS} update={() => {}} />}
    >
      <UrlBound view={View} params={params} shared={shared} />
    </Suspense>
  )
}

// The filter bar sits above the featured story (passed in from the server)
// and drives the latest-articles grid below it: category chips, a live search
// and pagination. Cards ease in whenever the visible set changes.
export function InsightsBrowser({
  id,
  content,
  articles,
  categories,
  copy,
  featured,
}: {
  id: string
  content: BlockView<"insights.browser">
  articles: ArticleSummary[]
  categories: CategoryView[]
  copy: GlobalValue<"microcopy">
  featured: React.ReactNode
}) {
  const params = useMemo(() => buildParams(categories), [categories])
  const shared: Shared = {
    articles,
    categories,
    copy,
    pageSize: content.pageSize,
    paging: content.paging,
  }

  return (
    <>
      <section
        id={id}
        aria-label={copy.featuredLabel}
        className="bg-white pt-6 pb-8 sm:pt-12 sm:pb-20 lg:pt-20 lg:pb-30"
      >
        <Container className="flex flex-col gap-5 sm:gap-14">
          {withUrl(FilterBar, params, shared)}
          {featured}
        </Container>
      </section>

      <section
        aria-labelledby={`${id}-heading`}
        className="bg-cream pt-8 pb-12 sm:bg-stone sm:py-20 lg:py-30"
      >
        <Container className="flex flex-col gap-4 sm:gap-12">
          <div className="flex items-end justify-between gap-4 sm:flex-wrap">
            <h2
              id={`${id}-heading`}
              data-motion="words"
              className="text-xl leading-6.5 font-semibold tracking-[-0.2px] text-forest sm:font-display sm:text-[52px] sm:leading-[1.3] sm:font-bold sm:tracking-normal sm:text-pine sm:[font-variation-settings:'SOFT'_0,'WONK'_1]"
            >
              {content.heading}
            </h2>
            {withUrl(Count, params, shared)}
          </div>
          {withUrl(Results, params, shared)}
        </Container>
      </section>
    </>
  )
}

function FilterBar({ categories, copy, state, update }: ViewProps) {
  const filters = [{ slug: null, name: copy.allArticles }, ...categories]

  return (
    <div className="flex flex-col gap-3.5 sm:gap-5 sm:border-b sm:border-line-soft sm:pb-7 lg:flex-row lg:items-center lg:justify-between">
      <div
        role="group"
        aria-label={copy.filterLabel}
        className="-mx-5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:gap-2.5 sm:px-0"
      >
        {filters.map((item) => {
          const selected = item.slug === state.category
          return (
            <button
              key={item.slug ?? "all"}
              type="button"
              aria-pressed={selected}
              onClick={() => update({ category: item.slug, page: null })}
              className={cn(
                "shrink-0 cursor-pointer rounded-full border px-4 py-2 text-[13px] leading-4.75 font-medium whitespace-nowrap transition-colors duration-300 outline-none focus-visible:ring-3 focus-visible:ring-clay/50 sm:border-0 sm:px-4.5 sm:py-2.5 sm:text-base sm:leading-[1.5]",
                selected
                  ? "border-pine bg-pine text-cream"
                  : "border-pine/25 bg-white text-pine hover:bg-mist sm:bg-stone sm:text-ink-muted"
              )}
            >
              {item.name}
            </button>
          )
        })}
      </div>

      <label className="order-first flex h-12 shrink-0 items-center gap-2.5 rounded-full bg-stone px-4 transition-colors sm:order-none sm:h-auto sm:gap-2 sm:border sm:border-line sm:bg-transparent sm:px-4.5 sm:py-2.75 sm:focus-within:border-pine/50">
        <Image
          src="/images/insights/icon-search.svg"
          alt=""
          width={24}
          height={24}
          className="size-4.5 sm:size-6"
        />
        <span className="sr-only">{copy.searchLabel}</span>
        <input
          type="search"
          value={state.q}
          // Each keystroke replaces the entry, so Back skips past the typing.
          onChange={(event) =>
            update({ q: event.target.value || null, page: null }, "replace")
          }
          placeholder={copy.searchPlaceholder}
          className="w-full bg-transparent text-[15px] leading-5.75 text-ink outline-none placeholder:text-text-subtle sm:text-base sm:leading-[1.5] lg:w-42.5"
        />
      </label>
    </div>
  )
}

function useResults(
  articles: ArticleSummary[],
  pageSize: number,
  state: State,
  paging: Shared["paging"] = "pages"
) {
  const category = state.category
  const deferredQuery = useDeferredValue(state.q.trim().toLowerCase())

  const filtered = useMemo(
    () =>
      articles.filter(
        (article) =>
          (!category || article.category.slug === category) &&
          (!deferredQuery ||
            matches(
              deferredQuery,
              article.title,
              article.excerpt,
              article.category.name
            ))
      ),
    [articles, category, deferredQuery]
  )

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(Math.max(1, state.page), pages)
  // "loadMore" keeps every earlier batch on screen; "pages" shows one page.
  const visible = filtered.slice(
    paging === "loadMore" ? 0 : (current - 1) * pageSize,
    current * pageSize
  )
  const key = `${category}|${deferredQuery}|${current}`

  return { filtered, pages, current, visible, key }
}

function Count({ articles, pageSize, paging, copy, state }: ViewProps) {
  const { filtered, visible } = useResults(articles, pageSize, state, paging)
  return (
    <p
      aria-live="polite"
      className="text-[13px] leading-4.75 whitespace-nowrap text-[#686561] sm:text-base sm:leading-[1.5] sm:text-text-muted"
    >
      {fill(copy.showing, { shown: visible.length, total: filtered.length })}
    </p>
  )
}

function Results({
  articles,
  pageSize,
  paging,
  copy,
  state,
  update,
}: ViewProps) {
  const { pages, current, visible, key } = useResults(
    articles,
    pageSize,
    state,
    paging
  )
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
          <div className="grid grid-cols-1 gap-3 sm:gap-x-7 sm:gap-y-14 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center">
            <p className="text-lg text-ink-muted">{copy.noResults}</p>
            <button
              type="button"
              onClick={clear}
              className="cursor-pointer text-[15px] font-semibold text-clay hover:underline hover:underline-offset-4"
            >
              {copy.clearFilters}
            </button>
          </div>
        )}
      </div>

      {paging === "loadMore" && current < pages && (
        <button
          type="button"
          // Replace, not push: Back leaves the list rather than un-loading.
          onClick={() => update({ page: current + 1 }, "replace")}
          className="h-13 w-full cursor-pointer rounded-full border border-brand text-base leading-5 font-semibold text-brand transition-colors hover:bg-brand/5 sm:mx-auto sm:w-auto sm:px-8"
        >
          {copy.loadMore || copy.nextPage}
        </button>
      )}

      {paging === "pages" && pages > 1 && (
        <nav aria-label={copy.pagination} className="flex justify-center">
          <ol className="flex items-center gap-2.5">
            <li>
              <PageButton
                label={copy.previousPage}
                disabled={current === 1}
                onClick={() => goTo(current - 1)}
              >
                ←
              </PageButton>
            </li>
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <li key={n}>
                <PageButton
                  label={fill(copy.pageLabel, { n })}
                  active={n === current}
                  onClick={() => goTo(n)}
                >
                  {n}
                </PageButton>
              </li>
            ))}
            <li>
              <PageButton
                label={copy.nextPage}
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
