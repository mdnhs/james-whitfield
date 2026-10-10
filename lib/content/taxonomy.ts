import * as z from "zod"

import { MediaRef, optionalText, text } from "@/blocks/fields"

import { Slug } from "./slug"

export const TAXONOMIES = ["categories", "authors"] as const
export type Taxonomy = (typeof TAXONOMIES)[number]

export const CategoryInput = z.object({
  slug: Slug,
  name: text(60),
  description: optionalText(300),
  relatedServiceId: z.uuid().nullable(),
  isVisible: z.boolean(),
})
// The avatar becomes optional with its migration in Task 2 (Ruling R2).
export const AuthorInput = z.object({
  slug: Slug,
  name: text(80),
  roleTitle: optionalText(80),
  bio: optionalText(600),
  avatar: MediaRef,
  isVisible: z.boolean(),
})
