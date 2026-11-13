import { describe, expect, it } from "vitest"

import { linkForPath } from "@/lib/admin/nav"
import { hasPermission, ROLE_NAMES } from "@/lib/auth/permissions"

import {
  articleLinks,
  canFollow,
  groupedArticles,
  HELP_ARTICLES,
  HELP_GROUPS,
  HELP_HREF,
  headingId,
  helpArticle,
  neighbours,
  searchHelp,
  tocFor,
  visibleArticles,
} from "./registry"

const slugs = (articles: readonly { slug: string }[]) =>
  articles.map((article) => article.slug)

describe("help registry", () => {
  it("has unique slugs", () => {
    const all = slugs(HELP_ARTICLES)
    expect(new Set(all).size).toBe(all.length)
  })

  it("puts at least one article in every group", () => {
    for (const group of HELP_GROUPS) {
      expect(
        HELP_ARTICLES.filter((article) => article.group === group.id),
        group.id
      ).not.toHaveLength(0)
    }
  })

  it("files every article under a known group", () => {
    const ids = new Set(HELP_GROUPS.map((group) => group.id))
    for (const article of HELP_ARTICLES) expect(ids).toContain(article.group)
  })

  it("covers the essentials", () => {
    expect(slugs(HELP_ARTICLES)).toEqual(
      expect.arrayContaining([
        "getting-started",
        "saving-and-publishing",
        "roles",
        "dashboard",
        "website-pages",
        "services",
        "legal-pages",
        "header-footer",
        "testimonials",
        "hero-background",
        "insights-articles",
        "insights-categories-authors",
        "media",
        "enquiries",
        "live-chat",
        "newsletter",
        "seo",
        "marketing",
        "site-settings",
        "appearance",
        "ai-assistant",
        "users",
        "activity-log",
        "account",
        "troubleshooting",
      ])
    )
  })

  describe.each(HELP_ARTICLES.map((article) => [article.slug, article]))(
    "%s",
    (_, article) => {
      it("links only to real admin screens and help articles", () => {
        for (const href of articleLinks(article)) {
          const [path, hash] = href.split("#") as [string, string | undefined]
          expect(path, href).toMatch(/^\/admin(\/|$)/)
          if (path.startsWith(`${HELP_HREF}/`)) {
            const target = helpArticle(path.slice(HELP_HREF.length + 1))
            expect(target, href).toBeDefined()
            if (hash)
              expect(tocFor(target!).map((entry) => entry.id)).toContain(hash)
          } else if (path !== HELP_HREF) {
            // A real nav href: the same registry the sidebar and guards read.
            expect(linkForPath(path), href).toBeDefined()
          }
        }
      })

      it("has a title, description, lead and sections", () => {
        expect(article.title).not.toBe("")
        expect(article.description).not.toBe("")
        expect(article.lead).not.toBe("")
        expect(article.sections.length).toBeGreaterThan(0)
      })
    }
  )
})

describe("tocFor", () => {
  it("builds one entry per section heading, in order", () => {
    for (const article of HELP_ARTICLES) {
      const toc = tocFor(article)
      expect(toc.map((entry) => entry.title)).toEqual(
        article.sections.map((section) => section.title)
      )
      expect(toc.map((entry) => entry.id)).toEqual(
        article.sections.map((section) => headingId(section.title))
      )
      // Anchors must be unique within a page.
      expect(new Set(toc.map((entry) => entry.id)).size).toBe(toc.length)
    }
  })

  it("makes readable anchors", () => {
    expect(headingId("Contact & clinic")).toBe("contact-and-clinic")
    expect(headingId("I saved but the site didn't change")).toBe(
      "i-saved-but-the-site-didn-t-change"
    )
    expect(headingId("Search with ⌘K")).toBe("search-with-k")
  })
})

describe("role filtering", () => {
  it("shows an owner every article", () => {
    expect(slugs(visibleArticles(["owner"]))).toEqual(slugs(HELP_ARTICLES))
  })

  it("shows intake the basics, enquiries and chat, but no website docs", () => {
    const visible = slugs(visibleArticles(["intake"]))
    expect(visible).toEqual(
      expect.arrayContaining([
        "getting-started",
        "enquiries",
        "live-chat",
        "account",
        "troubleshooting",
      ])
    )
    for (const hidden of [
      "website-pages",
      "media",
      "seo",
      "users",
      "ai-assistant",
      "newsletter",
    ])
      expect(visible).not.toContain(hidden)
  })

  it("keeps enquiries docs from a marketer", () => {
    const visible = slugs(visibleArticles(["marketer"]))
    expect(visible).toContain("marketing")
    expect(visible).not.toContain("enquiries")
    expect(visible).not.toContain("live-chat")
  })

  it("lists only articles whose screens each role opens", () => {
    for (const role of ROLE_NAMES) {
      for (const article of visibleArticles([role])) {
        if (article.permission)
          expect(hasPermission([role], article.permission)).toBe(true)
      }
    }
  })

  it("drops empty groups", () => {
    const groups = groupedArticles(["intake"])
    expect(groups.every((group) => group.articles.length > 0)).toBe(true)
    expect(groups.map((group) => group.id)).not.toContain("website")
  })

  it("never offers a link to a screen the role cannot open", () => {
    expect(canFollow(["intake"], "/admin/leads")).toBe(true)
    expect(canFollow(["intake"], "/admin/users")).toBe(false)
    expect(canFollow(["intake"], "/admin/help/roles")).toBe(true)
    expect(canFollow(["intake"], "/admin/help/media#focal-point")).toBe(false)
    expect(canFollow(["owner"], "/admin/help/media#focal-point")).toBe(true)
    expect(canFollow(["owner"], "/admin/nowhere")).toBe(false)
  })

  it("steps Prev/Next through visible articles only", () => {
    const { prev, next } = neighbours(["intake"], "enquiries")
    for (const article of [prev, next]) {
      if (article)
        expect(slugs(visibleArticles(["intake"]))).toContain(article.slug)
    }
    expect(neighbours(["owner"], "getting-started").prev).toBeUndefined()
    expect(neighbours(["owner"], "troubleshooting").next).toBeUndefined()
  })
})

describe("searchHelp", () => {
  it("finds articles by keyword for roles that can read them", () => {
    expect(slugs(searchHelp(["owner"], "focal point"))).toContain("media")
    expect(slugs(searchHelp(["intake"], "focal point"))).toEqual([])
  })

  it("returns nothing for an empty query", () => {
    expect(searchHelp(["owner"], "  ")).toEqual([])
  })
})
