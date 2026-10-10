import type { MetadataRoute } from "next"

// docs/brief.md §11 + Ruling R14.
export function robotsFor(
  siteEnv: "production" | "staging" | "development",
  seo: { robots: "index" | "noindex" },
  siteUrl: string
): MetadataRoute.Robots {
  if (siteEnv !== "production" || seo.robots === "noindex") {
    return { rules: [{ userAgent: "*", disallow: "/" }] }
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
    sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  }
}
