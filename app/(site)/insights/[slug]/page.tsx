import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { JourneyRail } from "@/components/journey-rail"
import { PageMotion } from "@/components/page-motion"
import { StackCard } from "@/components/stack-card"
import {
  ArticleBody,
  ArticleHero,
  NewsletterBand,
  RelatedArticles,
} from "@/features/insights"
import { contactHref } from "@/lib/contact-href"
import {
  ALL_ARTICLES,
  getArticle,
  relatedArticles,
} from "@/features/insights/data/articles"
import { MICROCOPY } from "@/features/site/data/microcopy"

import * as legacy from "../../_legacy/views"

// Known slugs prerender at build. Any other slug renders on request and hits
// notFound() below (dynamicParams is not allowed with Cache Components).

export function generateStaticParams() {
  return ALL_ARTICLES.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params,
}: PageProps<"/insights/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) return {}

  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      publishedTime: article.date.iso,
      authors: [article.author.name],
      images: [article.image],
    },
  }
}

const CHAPTERS = [
  { label: "Welcome", target: "home" },
  { label: "Article", target: "article" },
  { label: "Keep reading", target: "keep-reading" },
  { label: "Newsletter", target: "newsletter" },
  { label: "Contact", target: "contact" },
]

// Same scroll stack as the other pages: each chapter is a card that sticks
// while the next slides over it.
export default async function ArticlePage({
  params,
}: PageProps<"/insights/[slug]">) {
  const { slug } = await params
  const article = getArticle(slug)
  if (!article) notFound()
  const detail = legacy.articleDetail(article)

  return (
    <main data-page-root className="bg-ink">
      <StackCard id="home" rounded={false}>
        <ArticleHero article={detail} copy={MICROCOPY} />
      </StackCard>
      <StackCard id="article">
        <ArticleBody
          article={detail}
          copy={MICROCOPY}
          ctaHref={contactHref({
            plan: "discovery-call",
            topic: detail.topicSlug,
          })}
        />
      </StackCard>
      <StackCard>
        <RelatedArticles
          id="keep-reading"
          articles={relatedArticles(slug).map(legacy.articleSummary)}
          copy={MICROCOPY}
        />
      </StackCard>
      <StackCard last>
        <NewsletterBand id="newsletter" content={legacy.newsletter()} />
      </StackCard>
      <JourneyRail chapters={CHAPTERS} />
      <PageMotion />
    </main>
  )
}
