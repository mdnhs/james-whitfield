// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ArticleSummary } from "@/lib/content/types"

import { ArticleCard } from "./article-card"

const article: ArticleSummary = {
  id: "a1",
  slug: "what-to-expect",
  title: "What to expect",
  excerpt: "A first session explained.",
  image: {
    id: "m1",
    src: "/images/insights/room.png",
    width: 1600,
    height: 900,
    blurDataURL: null,
    alt: "Hypnotherapy room",
    focal: null,
  },
  category: { slug: "hypnotherapy", name: "Hypnotherapy" },
  author: { name: "Jane Doe", avatar: null },
  date: { iso: "2026-10-01", label: "1 Oct 2026" },
  readingMinutes: 4,
  featured: false,
}

describe("ArticleCard", () => {
  it("uses the library alt text for the card image", () => {
    const { container } = render(<ArticleCard article={article} />)
    const img = container.querySelector("img")!
    expect(img.getAttribute("alt")).toBe("Hypnotherapy room")
  })
})
