// blocks/registry.ts
import * as z from "zod"

import {
  aboutApproach,
  aboutCredentials,
  aboutStats,
  aboutStory,
  heroPage,
} from "./about"
import { contactClinic, contactDetails } from "./contact"
import { Anchor } from "./fields"
import {
  aboutIntro,
  band,
  credibility,
  faq,
  heroHome,
  insightsLatest,
  processBlock,
  testimonials,
} from "./home"
import { insightsBrowser, newsletter } from "./insights"
import { richtext } from "./richtext"
import { fit, servicesGrid, servicesPlans, sessionTimeline } from "./services"

// One entry per existing section design (docs/brief.md §6.2). API validation,
// admin forms, the renderer and the types all read this list.
export const BLOCKS = [
  heroHome,
  heroPage,
  credibility,
  aboutIntro,
  processBlock,
  testimonials,
  band,
  insightsLatest,
  faq,
  aboutStory,
  aboutStats,
  aboutApproach,
  aboutCredentials,
  servicesGrid,
  servicesPlans,
  sessionTimeline,
  fit,
  insightsBrowser,
  newsletter,
  contactDetails,
  contactClinic,
  richtext,
] as const

type AnyBlock = (typeof BLOCKS)[number]
export type BlockType = AnyBlock["type"]

export const BLOCK_BY_TYPE = Object.fromEntries(
  BLOCKS.map((block) => [block.type, block])
) as { [B in AnyBlock as B["type"]]: B }

const base = {
  // Stable across edits so the editor can follow a block. Seeded ids are
  // "<page>-<anchor>"; Phase 4 mints nanoids.
  id: z.string().regex(/^[A-Za-z0-9_-]{4,48}$/),
  anchor: Anchor,
  // JourneyRail label; null keeps the block out of the rail.
  chapter: z.string().trim().min(1).max(24).nullable(),
  hidden: z.boolean(),
  // Render inside the previous StackCard (e.g. Credibility + About intro).
  joinPrevious: z.boolean(),
}

const instance = <const T extends string, S extends z.ZodType>(block: {
  type: T
  schema: S
}) => z.object({ ...base, type: z.literal(block.type), data: block.schema })

export const BlockInstance = z.discriminatedUnion("type", [
  instance(heroHome),
  instance(heroPage),
  instance(credibility),
  instance(aboutIntro),
  instance(processBlock),
  instance(testimonials),
  instance(band),
  instance(insightsLatest),
  instance(faq),
  instance(aboutStory),
  instance(aboutStats),
  instance(aboutApproach),
  instance(aboutCredentials),
  instance(servicesGrid),
  instance(servicesPlans),
  instance(sessionTimeline),
  instance(fit),
  instance(insightsBrowser),
  instance(newsletter),
  instance(contactDetails),
  instance(contactClinic),
  instance(richtext),
])

export type BlockInstance = z.infer<typeof BlockInstance>
export type BlockData<T extends BlockType> = Extract<
  BlockInstance,
  { type: T }
>["data"]
