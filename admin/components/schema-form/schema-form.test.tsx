// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as z from "zod"
import { describe, expect, it, vi } from "vitest"

import { LinkValue, Stat } from "@/blocks/fields"

import { ui } from "./registry"
import { SchemaForm } from "./schema-form"

const Schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Enter your name")
      .max(20)
      .register(ui, { label: "Full name" }),
    newsletter: z
      .boolean()
      .default(false)
      .register(ui, { label: "Newsletter" }),
    password: z
      .string()
      .min(4, "Too short")
      .register(ui, { label: "Password", inputType: "password" }),
    confirm: z
      .string()
      .register(ui, { label: "Confirm password", inputType: "password" }),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "The passwords don't match",
  })

const defaults = { name: "", newsletter: false, password: "", confirm: "" }

describe("SchemaForm", () => {
  it("renders labelled widgets with a live character counter", async () => {
    render(
      <SchemaForm
        schema={Schema}
        defaultValues={defaults}
        submitLabel="Save"
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText("0/20")).toBeTruthy()
    await userEvent.type(screen.getByLabelText("Full name"), "Magda")
    expect(screen.getByText("5/20")).toBeTruthy()
    expect(screen.getByRole("switch", { name: "Newsletter" })).toBeTruthy()
    expect(screen.getByLabelText("Password").getAttribute("type")).toBe(
      "password"
    )
  })

  // toJSONSchema drops refinements; validation must still use them.
  it("validates with the Zod schema, refinements included", async () => {
    const onSubmit = vi.fn()
    render(
      <SchemaForm
        schema={Schema}
        defaultValues={defaults}
        submitLabel="Save"
        onSubmit={onSubmit}
      />
    )
    await userEvent.type(screen.getByLabelText("Full name"), "Magda")
    await userEvent.type(screen.getByLabelText("Password"), "secret")
    await userEvent.type(screen.getByLabelText("Confirm password"), "other")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("The passwords don't match")).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("submits the parsed output", async () => {
    const onSubmit = vi.fn()
    render(
      <SchemaForm
        schema={Schema}
        defaultValues={defaults}
        submitLabel="Save"
        onSubmit={onSubmit}
      />
    )
    await userEvent.type(screen.getByLabelText("Full name"), "  Magda  ")
    await userEvent.type(screen.getByLabelText("Password"), "secret")
    await userEvent.type(screen.getByLabelText("Confirm password"), "secret")
    await userEvent.click(screen.getByRole("switch", { name: "Newsletter" }))
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    await vi.waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Magda",
        newsletter: true,
        password: "secret",
        confirm: "secret",
      })
    )
  })

  it("shows a form error when onSubmit throws", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    const onSubmit = vi.fn(async () => {
      throw new Error("boom")
    })
    render(
      <SchemaForm
        schema={Schema}
        defaultValues={{
          ...defaults,
          name: "M",
          password: "abcd",
          confirm: "abcd",
        }}
        submitLabel="Save"
        onSubmit={onSubmit}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(
      await screen.findByText("Something went wrong. Try again.")
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
      "disabled",
      false
    )
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })

  it("shows the error of a list item that fails validation", async () => {
    const ListSchema = z.object({
      tags: z
        .array(z.string().max(5, "Keep each tag short"))
        .register(ui, { label: "Tags" }),
    })
    const onSubmit = vi.fn()
    render(
      <SchemaForm
        schema={ListSchema}
        defaultValues={{ tags: ["ok", "far too long"] }}
        submitLabel="Save"
        onSubmit={onSubmit}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("Keep each tag short")).toBeTruthy()
    expect(screen.getByLabelText("Tags 2").getAttribute("aria-invalid")).toBe(
      "true"
    )
    expect(screen.getByLabelText("Tags 1").getAttribute("aria-invalid")).toBe(
      null
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("shows field and form errors from the server", async () => {
    const onSubmit = vi.fn(async () => ({
      fieldErrors: { name: ["That name is taken"] },
      formError: "Nothing was saved",
    }))
    render(
      <SchemaForm
        schema={Schema}
        defaultValues={{
          ...defaults,
          name: "M",
          password: "abcd",
          confirm: "abcd",
        }}
        submitLabel="Save"
        onSubmit={onSubmit}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("That name is taken")).toBeTruthy()
    expect(screen.getByText("Nothing was saved")).toBeTruthy()
  })
})
describe("content widgets", () => {
  it("adds an object item to a list and renders link fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ items: [], page: 1, pageSize: 0, total: 0 })
      )
    )
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SchemaForm
          schema={z.object({ cta: LinkValue, stats: z.array(Stat).max(4) })}
          defaultValues={{ cta: { label: "", href: "" }, stats: [] }}
          onSubmit={() => {}}
          submitLabel="Save"
        />
      </QueryClientProvider>
    )
    expect(screen.getByLabelText("Link text")).toBeTruthy()
    expect(screen.getByLabelText("Link target")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Add to stats" }))
    expect(screen.getByRole("group", { name: "Stats 1" })).toBeTruthy()
    vi.unstubAllGlobals()
  })
})

describe("onValuesChange", () => {
  it("reports values as the user types", async () => {
    const seen: unknown[] = []
    render(
      <SchemaForm
        schema={z.object({
          title: z.string().max(70).register(ui, { label: "Title" }),
        })}
        defaultValues={{ title: "" }}
        submitLabel="Save"
        onSubmit={() => undefined}
        onValuesChange={(v) => seen.push(v)}
      />
    )
    await userEvent.type(screen.getByLabelText("Title"), "Hi")
    expect(seen.at(-1)).toEqual({ title: "Hi" })
  })
})
