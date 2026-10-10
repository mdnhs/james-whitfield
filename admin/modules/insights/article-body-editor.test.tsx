// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
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
})
