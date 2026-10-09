import { ALL_ARTICLES } from "./articles"

export type Post = {
  slug: string
  category: string
  // "\n" marks the design's line breaks.
  title: string
  excerpt: string
  image: string
  author: { name: string; avatar: string }
  date: { label: string; iso: string }
}

export const INSIGHTS_HEADER = {
  title: "Insights",
  subtitle:
    "Thoughtful perspectives on coaching and hypnotherapy as serious tools for meaningful change",
  cta: { label: "View all posts", href: "/insights" },
}

// The home page previews the newest articles, so every card opens a real page.
export const POSTS: Post[] = ALL_ARTICLES.slice(0, 3)
