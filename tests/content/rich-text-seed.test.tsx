// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { expect, it } from "vitest"

import { RichText } from "@/features/insights/components/rich-text"
import { ARTICLE_BODIES } from "@/server/db/seed/fixtures/article-bodies"
import { toTipTap } from "@/server/db/seed/tiptap"

// Every seeded article body. Recorded from the hand-written Phase 3 renderer;
// the static renderer must reproduce it byte for byte (the article parity
// baseline depends on it).
it.each(Object.keys(ARTICLE_BODIES))("%s renders as before", async (slug) => {
  const { container } = render(
    <RichText doc={toTipTap(ARTICLE_BODIES[slug]!)} />
  )
  await expect(container.innerHTML).toMatchFileSnapshot(
    `./__snapshots__/seed/${slug}.html`
  )
})
