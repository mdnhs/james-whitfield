import type { RoleName } from "./permissions"

export const ROLE_LABELS: Record<RoleName, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  author: "Author",
  marketer: "Marketer",
  intake: "Intake",
  viewer: "Viewer",
}

// docs/brief.md §7.2 "What each role is for".
export const ROLE_PURPOSE: Record<RoleName, string> = {
  owner: "Everything, including other owners and custom code.",
  admin: "Everything except custom code and managing owners.",
  editor: "Pages, articles, collections, site content, media and SEO.",
  author: "Their own articles, without publishing.",
  marketer: "SEO, redirects, tracking and the newsletter list. No enquiries.",
  intake: "The enquiries inbox only.",
  viewer: "Read-only access.",
}
