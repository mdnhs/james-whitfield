import * as z from "zod"

// docs/brief.md §8.2: slugs match ^[a-z0-9]+(-[a-z0-9]+)*$ in every table.
export const Slug = z
  .string()
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lower-case kebab-case, e.g. calm-is-a-skill"
  )
