import { Slug } from "./slug"

// The article route prerenders this one slug as its build shell (Cache
// Components needs a param and the build has no database). The slug pattern
// cannot produce it, so no real article can claim the shell.
export const ARTICLE_SHELL_SLUG = "__shell"

export const ArticleSlug = Slug
