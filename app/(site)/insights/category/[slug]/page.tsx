import type { Metadata } from "next"
import { io } from "next/cache"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Container } from "@/components/layout/container"
import { JsonLd } from "@/components/json-ld"
import { PageMotion } from "@/components/page-motion"
import { ArticleCard } from "@/features/insights/components/article-card"
import { InsightsRail } from "@/features/insights/components/insights-rail"
import { ARTICLE_SHELL_SLUG } from "@/lib/content/article-slug"
import { categoryHref } from "@/lib/content/taxonomy"
import { categorySubject } from "@/lib/seo/category"
import { breadcrumbNode, graph } from "@/lib/seo/json-ld"
import { buildMetadata } from "@/lib/seo/metadata"
import { getEnv } from "@/server/env"
import {
  getCategory,
  getCategoryArticles,
  getPublishedPage,
  getSetting,
} from "@/server/modules/content/queries"

import { seoDefaults } from "../../../_cms/seo-defaults"

// Same shell-param pattern as the article route: Cache Components needs one
// param to build the shell without the database. The sentinel is not a valid
// category slug, so it renders not-found.
export function generateStaticParams() {
  return [{ slug: ARTICLE_SHELL_SLUG }]
}

export async function generateMetadata({
  params,
}: PageProps<"/insights/category/[slug]">): Promise<Metadata> {
  await io()
  const { slug } = await params
  const category = await getCategory(slug)
  if (!category) notFound()
  return buildMetadata(categorySubject(category), await seoDefaults())
}

export default async function CategoryPage({
  params,
}: PageProps<"/insights/category/[slug]">) {
  await io()
  const { slug } = await params
  const [category, articles, copy, insights] = await Promise.all([
    getCategory(slug),
    getCategoryArticles(slug),
    getSetting("microcopy"),
    getPublishedPage("/insights"),
  ])
  if (!category) notFound()
  // The Insights crumb reads like the page itself: its hero title.
  const hero = insights?.document.blocks.find(
    (b) => !b.hidden && b.type === "hero.page"
  )
  const insightsName =
    hero?.type === "hero.page"
      ? hero.data.title
      : (insights?.title ?? copy.breadcrumbInsights)
  const origin = getEnv().SITE_URL.replace(/\/$/, "")

  return (
    <>
      <JsonLd
        graph={graph([
          breadcrumbNode(origin, [
            { name: copy.breadcrumbHome || "Home", path: "/" },
            { name: insightsName, path: "/insights" },
            { name: category.name, path: categoryHref(category.slug) },
          ]),
        ])}
      />
      <main key={slug} data-page-root>
        <section
          aria-labelledby="category-heading"
          className="relative flex w-full flex-col bg-hero-base"
        >
          <Container className="flex flex-col gap-6 pt-36 pb-12 sm:gap-7 sm:pb-16 lg:pb-20">
            <nav
              aria-label="Breadcrumb"
              data-motion="rise"
              className="inline-flex max-w-full items-center gap-2.25 self-start overflow-hidden rounded-full border border-white/10 bg-[rgba(231,239,238,0.05)] py-2.25 pr-4 pl-3.5 text-sm leading-[1.5] backdrop-blur-sm"
            >
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full bg-white"
              />
              <Link
                href="/"
                className="text-white/70 transition-colors hover:text-white"
              >
                {copy.breadcrumbHome}
              </Link>
              <span aria-hidden className="text-white/40">
                /
              </span>
              <Link
                href="/insights"
                className="text-white/70 transition-colors hover:text-white"
              >
                {copy.breadcrumbInsights}
              </Link>
              <span aria-hidden className="text-white/40">
                /
              </span>
              <span
                aria-current="page"
                className="truncate font-medium text-white"
              >
                {category.name}
              </span>
            </nav>
            <h1
              id="category-heading"
              data-motion="rise"
              data-delay="0.1"
              className="font-display text-[40px] leading-[1.1] font-semibold text-white [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[56px] xl:text-[72px]"
            >
              {category.name}
            </h1>
            {category.description && (
              <p
                data-motion="rise"
                data-delay="0.2"
                className="max-w-180 text-[17px] leading-6.5 text-mist sm:text-xl sm:leading-[1.55] sm:text-white/84"
              >
                {category.description}
              </p>
            )}
          </Container>
        </section>

        <section
          aria-labelledby="category-heading"
          className="bg-cream pt-8 pb-12 sm:bg-stone sm:py-20 lg:py-30"
        >
          <Container>
            {articles.length > 0 ? (
              <InsightsRail>
                {articles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </InsightsRail>
            ) : (
              copy.categoryEmpty && (
                <p className="text-base leading-[1.5] text-text-muted">
                  {copy.categoryEmpty}
                </p>
              )
            )}
          </Container>
        </section>
        <PageMotion />
      </main>
    </>
  )
}
