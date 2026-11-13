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
  category: { slug: "hypnotherapy", name: "Hypnotherapy", isVisible: true },
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

  it("links the category label to its hub when the category is visible", () => {
    const { container } = render(<ArticleCard article={article} />)
    expect(
      container.querySelector('a[href="/insights/category/hypnotherapy"]')
    ).not.toBeNull()
  })

  it("renders the category label without a link when it is hidden", () => {
    const hidden = {
      ...article,
      category: { ...article.category, isVisible: false },
    }
    const { container, getByText } = render(<ArticleCard article={hidden} />)
    expect(getByText("Hypnotherapy")).toBeTruthy()
    expect(container.querySelector('a[href*="/insights/category/"]')).toBeNull()
  })
})
