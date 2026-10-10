// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ArticleBodyEditor } from "./article-body-editor"

const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `w${i}`).join(" ")
const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})
const ui = (props: Partial<Parameters<typeof ArticleBodyEditor>[0]>) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ArticleBodyEditor
        value={doc("Hello")}
        onChange={vi.fn()}
        readOnly={false}
        {...props}
      />
    </QueryClientProvider>
  )

describe("ArticleBodyEditor", () => {
  it("shows the live reading time", () => {
    ui({ value: doc(words(660)) })
    expect(screen.getByText("3 min read")).toBeTruthy()
  })
  it("is a labelled textbox with an Image button", async () => {
    ui({})
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Article body" })).toBeTruthy()
    )
    expect(screen.getByRole("button", { name: "Image" })).toBeTruthy()
  })
  it("is read-only for viewers", async () => {
    ui({ readOnly: true })
    await waitFor(() =>
      expect(
        screen
          .getByRole("textbox", { name: "Article body" })
          .getAttribute("contenteditable")
      ).toBe("false")
    )
    expect(screen.queryByRole("button", { name: "Image" })).toBeNull()
  })

  const linked = {
    type: "doc" as const,
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "plain " },
          {
            type: "text",
            text: "linked",
            marks: [{ type: "link", attrs: { href: "/x" } }],
          },
        ],
      },
    ],
  }
  const caret = async (node: Node, offset: number) => {
    await act(async () => {
      const r = document.createRange()
      r.setStart(node, offset)
      r.collapse(true)
      const sel = window.getSelection()!
      sel.removeAllRanges()
      sel.addRange(r)
      document.dispatchEvent(new Event("selectionchange"))
      await new Promise((res) => setTimeout(res, 50))
    })
  }
  it("tracks link state as the cursor moves", async () => {
    ui({ value: linked })
    const box = await screen.findByRole("textbox", { name: "Article body" })
    box.focus()
    const link = box.querySelector("a")!.firstChild!
    const plain = box.querySelector("p")!.firstChild!
    const btn = () => screen.getByRole("button", { name: "Link" })
    await caret(link, 2)
    await waitFor(() => expect(btn().getAttribute("aria-pressed")).toBe("true"))
    await caret(plain, 2)
    await waitFor(() =>
      expect(btn().getAttribute("aria-pressed")).toBe("false")
    )
  })
  it("keeps the selection when an equal value is re-rendered", async () => {
    const client = new QueryClient()
    const tree = (v: unknown) => (
      <QueryClientProvider client={client}>
        <ArticleBodyEditor
          value={v as never}
          onChange={vi.fn()}
          readOnly={false}
        />
      </QueryClientProvider>
    )
    const { rerender } = render(tree(doc("Hello world")))
    const box = await screen.findByRole("textbox", { name: "Article body" })
    await caret(box.querySelector("p")!.firstChild!, 3)
    rerender(tree(JSON.parse(JSON.stringify(doc("Hello world")))))
    await act(async () => {
      await new Promise((res) => setTimeout(res, 50))
    })
    expect(window.getSelection()!.anchorOffset).toBe(3)
  })
})
