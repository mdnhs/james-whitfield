// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { DraftBlock } from "@/blocks/page"

import { BlockOutline } from "./block-outline"

afterEach(cleanup)

const block = (id: string, type: DraftBlock["type"], hidden = false) =>
  ({
    id,
    type,
    anchor: id,
    chapter: null,
    hidden,
    joinPrevious: false,
    data: {},
  }) as DraftBlock

describe("BlockOutline", () => {
  it("renders one button per visible block and no structure controls", () => {
    render(
      <BlockOutline
        blocks={[block("a", "faq"), block("b", "fit"), block("c", "faq", true)]}
        selectedId="a"
        readOnly={false}
        onSelect={vi.fn()}
      />
    )
    expect(screen.getAllByRole("button")).toHaveLength(2)
    expect(
      screen.queryAllByRole("button", { name: /^(Reorder|Hide|Show|Remove) / })
    ).toHaveLength(0)
    expect(screen.queryByText("#c")).toBeNull()
  })
})
