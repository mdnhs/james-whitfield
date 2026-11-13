// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import * as z from "zod"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import { MediaRef, Selection, StatValue } from "@/blocks/fields"
import { RichTextDoc } from "@/blocks/rich-text"
import { permissionMap } from "@/lib/auth/permissions"

import { ui } from "../registry"
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
const owner = {
  user: { id: "u1", email: "o@example.com", name: "O" },
  roles: ["owner" as const],
  permissions: permissionMap(["owner"]),
  twoFactorEnabled: true,
  impersonatedBy: null,
}
const wrap = (node: React.ReactNode) =>
  render(
    <QueryClientProvider client={client()}>
      <AdminActorProvider value={owner}>{node}</AdminActorProvider>
    </QueryClientProvider>
  )

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
    await user.click(
      await screen.findByRole("button", { name: "Remove image" })
    )
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenLastCalledWith({ image: null })
    )
  })
})

describe("media picker upload", () => {
  it("uploads a new image and picks it for the field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ items: [], page: 1, pageSize: 40, total: 0 }))
    )
    const uploaded = {
      id: "11111111-1111-4111-8111-111111111111",
      url: "/uploads/new.png",
      filename: "new.png",
      mimeType: "image/png",
      alt: "",
      width: 10,
      height: 10,
      focalX: 0.5,
      focalY: 0.5,
    }
    const sent: string[] = []
    class FakeXHR {
      status = 201
      response: unknown = uploaded
      responseType = ""
      upload = { onprogress: null }
      onload: (() => void) | null = null
      open(_method: string, url: string) {
        sent.push(url)
      }
      send() {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal("XMLHttpRequest", FakeXHR)
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
    await user.upload(
      await screen.findByLabelText("Upload a new image"),
      new File(["x"], "new.png", { type: "image/png" })
    )
    await waitFor(() => expect(sent).toEqual(["/api/v1/admin/media"]))
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ image: { mediaId: uploaded.id } })
    )
  })
})

describe("selection schema", () => {
  it("rejects chosen with no ids (the widget keeps the mode and the form says so)", () => {
    expect(Selection.safeParse({ mode: "chosen", ids: [] }).success).toBe(false)
  })
})

describe("compact list rows", () => {
  it("shows a link list as one row per link, with plain column names", () => {
    wrap(
      <SchemaForm
        schema={z.object({
          links: z.array(
            z.object({ label: z.string().max(60), href: z.string().max(120) })
          ),
        })}
        defaultValues={{
          links: [
            { label: "About", href: "/about" },
            { label: "Contact", href: "/contact" },
          ],
        }}
        onSubmit={vi.fn()}
        submitLabel="Save"
      />
    )
    // Column names once, in plain words ("href" reads "Link").
    expect(screen.getAllByText("Link")).toHaveLength(1)
    const first = screen.getByRole("group", { name: "Links 1" })
    expect(
      within(first).getByRole("textbox", { name: "Label" })
    ).toHaveProperty("value", "About")
    expect(within(first).getByRole("textbox", { name: "Link" })).toHaveProperty(
      "value",
      "/about"
    )
    // No per-item heading text on screen.
    expect(screen.queryByText("Links 1")).toBeNull()
  })
})

describe("field help behind an info icon", () => {
  it("keeps the text as the control's and the icon's description, and opens on focus", async () => {
    const user = userEvent.setup()
    wrap(
      <SchemaForm
        schema={z.object({ url: z.string().max(100) })}
        overrides={{
          url: {
            label: "Profile address",
            description: "Starts with https://",
          },
        }}
        defaultValues={{ url: "" }}
        onSubmit={vi.fn()}
        submitLabel="Save"
      />
    )
    const input = screen.getByRole("textbox", { name: "Profile address" })
    const describedById = input.getAttribute("aria-describedby")!.split(" ")[0]!
    expect(document.getElementById(describedById)?.textContent).toBe(
      "Starts with https://"
    )
    const info = screen.getByRole("button", { name: "More info" })
    expect(info.getAttribute("aria-describedby")).toBe(describedById)
    // Not on screen until asked for.
    expect(screen.queryByRole("tooltip")).toBeNull()
    await user.tab()
    expect(document.activeElement).toBe(info)
    await waitFor(() =>
      expect(screen.getAllByText("Starts with https://")).toHaveLength(2)
    )
  })

  it("keeps a warning on screen under the field", () => {
    wrap(
      <SchemaForm
        schema={z.object({ include: z.boolean() })}
        overrides={{
          include: { description: "Emails leave the admin.", warning: true },
        }}
        defaultValues={{ include: false }}
        onSubmit={vi.fn()}
        submitLabel="Save"
      />
    )
    expect(screen.queryByRole("button", { name: "More info" })).toBeNull()
    expect(screen.getByText("Emails leave the admin.")).toBeTruthy()
  })
})

describe("list item headers", () => {
  it("names an item by its own first words, else by number", () => {
    wrap(
      <SchemaForm
        schema={z.object({
          social: z.array(
            z.object({
              platform: z.enum(["instagram", "facebook"]),
              url: z.string().max(200),
              note: z.string().max(200),
              extra: z.string().max(200),
            })
          ),
        })}
        overrides={{
          "social.$.platform": {
            options: [
              { value: "instagram", label: "Instagram" },
              { value: "facebook", label: "Facebook" },
            ],
          },
        }}
        defaultValues={{
          social: [
            { platform: "instagram", url: "", note: "", extra: "" },
            // Nothing picked yet: no words to show.
            { platform: "" as "instagram", url: "", note: "", extra: "" },
          ],
        }}
        onSubmit={vi.fn()}
        submitLabel="Save"
      />
    )
    const first = screen.getByRole("group", { name: "Social 1" })
    expect(
      within(first).getByText("Instagram", { selector: "[data-item-title]" })
    ).toBeTruthy()
    const second = screen.getByRole("group", { name: "Social 2" })
    expect(
      within(second).getByText("Item 2", { selector: "[data-item-title]" })
    ).toBeTruthy()
    // The buttons keep their numbered names.
    expect(screen.getByRole("button", { name: "Remove Social 1" })).toBeTruthy()
  })

  it("drops the repeated label of a one-field item from view", () => {
    wrap(
      <SchemaForm
        schema={z.object({
          notes: z.array(
            z.string().max(400).register(ui, { widget: "textarea" })
          ),
        })}
        defaultValues={{ notes: ["Hello there"] }}
        onSubmit={vi.fn()}
        submitLabel="Save"
      />
    )
    const item = screen.getByRole("group", { name: "Notes 1" })
    expect(
      within(item).getByText("Hello there", { selector: "[data-item-title]" })
    ).toBeTruthy()
    // Still the textarea's name, but visually hidden.
    const label = within(item).getByText("Notes 1", { selector: "label" })
    expect(label.className).toContain("sr-only")
    expect(within(item).getByRole("textbox", { name: "Notes 1" })).toBeTruthy()
  })
})
