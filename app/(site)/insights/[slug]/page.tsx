import type { Metadata } from "next"
import { io } from "next/cache"
import { notFound } from "next/navigation"

import { collectMediaIds, resolveMedia } from "@/blocks/media-refs"
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
import { ARTICLE_SHELL_SLUG } from "@/lib/content/article-slug"
import {
  getArticle,
  getMedia,
  getRelatedArticles,
  getSetting,
} from "@/server/modules/content/queries"

// Articles render on request from cached data. Cache Components needs at least
// one param to build the route's shell; a sentinel slug gives it one without
// reading the database. ArticleSlug cannot produce it, so it never names an
// article and renders not-found. Unknown slugs render not-found inside the
// streamed shell: 200 + noindex.
export function generateStaticParams() {
  return [{ slug: ARTICLE_SHELL_SLUG }]
}

export async function generateMetadata({
  params,
}: PageProps<"/insights/[slug]">): Promise<Metadata> {
  await io()
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) notFound()
  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      publishedTime: article.date.iso,
      authors: [article.author.name],
      images: [article.image.src],
    },
  }
}

// Fixed template (docs/brief.md §6.2): each chapter is a card that sticks
// while the next slides over it.
export default async function ArticlePage({
  params,
}: PageProps<"/insights/[slug]">) {
  await io()
  const { slug } = await params
  const [article, related, copy, newsletter] = await Promise.all([
    getArticle(slug),
    getRelatedArticles(slug, 3),
    getSetting("microcopy"),
    getSetting("newsletter"),
  ])
  if (!article) notFound()
  const band = resolveMedia(
    newsletter,
    await getMedia(collectMediaIds(newsletter))
  )
  const chapters = [
    { label: copy.articleChapters.welcome, target: "home" },
    { label: copy.articleChapters.article, target: "article" },
    { label: copy.articleChapters.keepReading, target: "keep-reading" },
    { label: copy.articleChapters.newsletter, target: "newsletter" },
    { label: copy.contactChapter, target: "contact" },
  ]
  return (
    <main key={slug} data-page-root className="bg-ink">
      <StackCard id="home" rounded={false}>
        <ArticleHero article={article} copy={copy} />
      </StackCard>
      <StackCard id="article">
        <ArticleBody
          article={article}
          copy={copy}
          ctaHref={contactHref({
            plan: "discovery-call",
            topic: article.topicSlug,
          })}
        />
      </StackCard>
      <StackCard>
        <RelatedArticles id="keep-reading" articles={related} copy={copy} />
      </StackCard>
      <StackCard last>
        <NewsletterBand id="newsletter" content={band} />
      </StackCard>
      <JourneyRail chapters={chapters} />
      <PageMotion />
    </main>
  )
}
