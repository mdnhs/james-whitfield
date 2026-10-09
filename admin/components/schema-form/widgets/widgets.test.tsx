// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import * as z from "zod"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { MediaRef, Selection, StatValue } from "@/blocks/fields"
import { RichTextDoc } from "@/blocks/rich-text"

import { SchemaForm } from "../schema-form"
import type { FormField } from "../to-fields"
import { CollectionWidget } from "./collection-widget"
import { RichTextWidget } from "./rich-text-widget"

// ProseMirror measures ranges; jsdom has no layout.
beforeAll(() => {
  const rect = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    toJSON() {},
  }
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => rect as DOMRect
  Element.prototype.getClientRects = () => [] as unknown as DOMRectList
  document.elementFromPoint = () => null
})
afterEach(() => vi.unstubAllGlobals())

const client = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } })
const wrap = (node: React.ReactNode) =>
  render(<QueryClientProvider client={client()}>{node}</QueryClientProvider>)

const json = (data: unknown) => Response.json(data)
const field = (over: Partial<FormField>): FormField => ({
  name: "f",
  label: "Thing",
  widget: "text",
  required: true,
  node: {},
  ...over,
})

const doc = (text: string) => ({
  type: "doc" as const,
  content: [
    { type: "paragraph" as const, content: [{ type: "text" as const, text }] },
  ],
})

function paste(target: Element, html: string, text = "") {
  fireEvent.paste(target, {
    clipboardData: {
      getData: (type: string) => (type === "text/html" ? html : text),
      types: ["text/html", "text/plain"],
      files: [],
      items: [],
    },
  })
}

describe("rich text widget", () => {
  it("strips pasted scripts, event handlers and javascript: links", async () => {
    const onChange = vi.fn()
    render(
      <RichTextWidget
        field={field({ widget: "richtext", label: "Body" })}
        value={doc("start")}
        onChange={onChange}
      />
    )
    const editor = await screen.findByRole("textbox", { name: "Body" })
    editor.focus()
    paste(
      editor,
      '<p>safe</p><script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">bad</a>',
      "safe"
    )
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const last = JSON.stringify(onChange.mock.calls.at(-1)![0])
    expect(last).not.toMatch(/script|onerror|javascript:|img|alert/)
    expect(last).toContain("safe")
  })

  it("Enter in the link input applies the link and does not submit the form", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <SchemaForm
        schema={z.object({ doc: RichTextDoc })}
        defaultValues={{ doc: doc("hello") }}
        onSubmit={onSubmit}
        submitLabel="Save"
      />
    )
    const editor = await screen.findByRole("textbox", { name: "Doc" })
    await user.click(editor)
    await user.keyboard("{Control>}a{/Control}")
    await user.click(screen.getByRole("button", { name: "Link" }))
    const input = screen.getByLabelText("Link target")
    await user.type(input, "javascript:alert(1){Enter}")
    expect(screen.getByRole("alert").textContent).toMatch(/Use \/path/)
    expect(input.getAttribute("aria-invalid")).toBe("true")
    await user.clear(input)
    await user.type(input, "/contact{Enter}")
    expect(screen.queryByLabelText("Link target")).toBeNull()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(editor.querySelector("a")?.getAttribute("href")).toBe("/contact")
  })

  it("re-syncs when the value changes from outside", async () => {
    function Harness() {
      const [value, setValue] = useState<unknown>(doc("one"))
      return (
        <>
          <button type="button" onClick={() => setValue(doc("restored"))}>
            Restore
          </button>
          <RichTextWidget
            field={field({ widget: "richtext", label: "Body" })}
            value={value}
            onChange={setValue}
          />
        </>
      )
    }
    render(<Harness />)
    const editor = await screen.findByRole("textbox", { name: "Body" })
    expect(editor.textContent).toBe("one")
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Restore" }))
    )
    await waitFor(() => expect(editor.textContent).toBe("restored"))
  })

  it("wires the error to the editor", async () => {
    render(
      <RichTextWidget
        field={field({ widget: "richtext", label: "Body" })}
        value={doc("x")}
        onChange={() => {}}
        error="Too long"
      />
    )
    const editor = await screen.findByRole("textbox", { name: "Body" })
    expect(editor.getAttribute("aria-invalid")).toBe("true")
    expect(editor.getAttribute("aria-describedby")).toContain("-error")
  })
})

describe("collection widget", () => {
  const options = {
    items: [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
    ],
  }
  const stub = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(options))
    )

  it("toggles all / chosen and keeps Only these after unchecking the last row", async () => {
    stub()
    const user = userEvent.setup()
    const seen: unknown[] = []
    function Harness() {
      const [value, setValue] = useState<unknown>({ mode: "all" })
      return (
        <CollectionWidget
          field={field({ widget: "collection", collection: "faqs", node: {} })}
          value={value as { mode: "all" }}
          onChange={(next) => {
            seen.push(next)
            setValue(next)
          }}
        />
      )
    }
    wrap(<Harness />)
    // Switch before the options load: sane empty selection.
    await user.click(screen.getByRole("radio", { name: /Only these/ }))
    expect(seen.at(-1)).toEqual({ mode: "chosen", ids: [] })
    await user.click(await screen.findByRole("checkbox", { name: /Alpha/ }))
    await user.click(screen.getByRole("checkbox", { name: /Beta/ }))
    expect(seen.at(-1)).toEqual({ mode: "chosen", ids: ["a", "b"] })
    await user.click(screen.getByRole("checkbox", { name: /Alpha/ }))
    await user.click(screen.getByRole("checkbox", { name: /Beta/ }))
    expect(seen.at(-1)).toEqual({ mode: "chosen", ids: [] })
    expect(
      screen
        .getByRole("radio", { name: /Only these/ })
        .getAttribute("aria-checked")
    ).toBe("true")
    await user.click(screen.getByRole("radio", { name: /All/ }))
    expect(seen.at(-1)).toEqual({ mode: "all" })
  })
})

describe("stat widget in a form", () => {
  it("switches kind and allows an empty number while typing", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <SchemaForm
        schema={z.object({ s: StatValue })}
        defaultValues={{
          s: { kind: "count", value: 5, decimals: 0, prefix: "", suffix: "" },
        }}
        onSubmit={onSubmit}
        submitLabel="Save"
      />
    )
    const value = screen.getByLabelText("Value") as HTMLInputElement
    await user.clear(value)
    expect(value.value).toBe("")
    await user.type(value, "12")
    await user.click(screen.getByRole("radio", { name: /Text/ }))
    await user.type(screen.getByRole("textbox", { name: "Text" }), "24/7")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0]![0]).toEqual({
      s: { kind: "text", text: "24/7" },
    })
  })
})

describe("nullable toggle", () => {
  it("turns an optional object on with a complete value and off to null", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <SchemaForm
        schema={z.object({ s: StatValue.nullable() })}
        defaultValues={{ s: null }}
        onSubmit={onSubmit}
        submitLabel="Save"
      />
    )
    expect(screen.queryByLabelText("Value")).toBeNull()
    await user.click(screen.getByRole("switch", { name: "S" }))
    expect(screen.getByLabelText("Value")).toBeTruthy()
    await user.click(screen.getByRole("switch", { name: "S" }))
    expect(screen.queryByLabelText("Value")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ s: null }))
  })
})

describe("media widget", () => {
  const ID = "11111111-1111-4111-8111-111111111111"
  const item = {
    id: ID,
    filename: "a.jpg",
    alt: "A cat",
    mimeType: "image/jpeg",
    url: "/media/a.jpg",
    width: 100,
    height: 80,
    focalX: 0.5,
    focalY: 0.5,
  }

  it("selects from the library and removes when nullable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({ items: [item], page: 1, pageSize: 40, total: 1 })
      )
    )
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    wrap(
      <SchemaForm
        schema={z.object({ image: MediaRef.nullable() })}
        defaultValues={{ image: null }}
        onSubmit={onSubmit}
        submitLabel="Save"
      />
    )
    await user.click(screen.getByRole("button", { name: "Image" }))
    await user.click(await screen.findByRole("button", { name: /A cat/ }))
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ image: { mediaId: ID } })
    )
    await user.click(await screen.findByRole("button", { name: "Remove" }))
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenLastCalledWith({ image: null })
    )
  })
})

describe("selection schema", () => {
  it("rejects chosen with no ids (the widget keeps the mode and the form says so)", () => {
    expect(Selection.safeParse({ mode: "chosen", ids: [] }).success).toBe(false)
  })
})
