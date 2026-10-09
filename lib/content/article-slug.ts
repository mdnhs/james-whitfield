import * as z from "zod"

// The article route prerenders this one slug as its build shell (Cache
// Components needs a param and the build has no database). The slug pattern
// cannot produce it, so no real article can claim the shell.
export const ARTICLE_SHELL_SLUG = "__shell"

export const ArticleSlug = z
  .string()
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lower-case kebab-case, e.g. calm-is-a-skill"
  )
