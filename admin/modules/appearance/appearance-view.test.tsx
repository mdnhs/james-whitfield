// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"
import { permissionMap, type RoleName } from "@/lib/auth/permissions"
import { DEFAULT_THEME, ThemeConfig } from "@/lib/theme/schema"
import { checkTheme } from "@/lib/theme/checks"

import { AppearanceView } from "./appearance-view"

// jsdom cannot reload an iframe.
vi.mock("@/admin/modules/pages/preview-pane", () => ({
  PreviewPane: () => null,
  previewSrc: (path: string) => path,
}))
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const actor = (roles: RoleName[]): MePayload => ({
  user: { id: "u1", email: "o@example.com", name: "O" },
  roles,
  permissions: permissionMap(roles),
  twoFactorEnabled: true,
  impersonatedBy: null,
})

const docFor = (draft: unknown, version = 3) => {
  const parsed = ThemeConfig.parse(draft)
  return {
    value: DEFAULT_THEME,
    draft: parsed,
    hasDraft: true,
    version,
    updatedAt: null,
    issues: checkTheme(parsed),
  }
}

function setup(initial: ReturnType<typeof docFor>) {
  const calls: { url: string; body: unknown }[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : null
      calls.push({ url, body })
      if (url.endsWith("/theme") || url.endsWith("/theme/"))
        return Response.json(initial)
      if (url.includes("/theme/revisions")) return Response.json([])
      if (url.includes("/globals/site"))
        return Response.json({
          key: "site",
          value: { logo: null, icon: null },
          version: 1,
        })
      if (url.endsWith("/theme/draft"))
        return Response.json(docFor(body.draft, body.version + 1))
      if (url.endsWith("/theme/publish"))
        return Response.json({ ...initial, hasDraft: false })
      return Response.json({})
    })
  )
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <AdminActorProvider value={actor(["owner"])}>
        <AppearanceView autosaveDelay={0} />
      </AdminActorProvider>
    </QueryClientProvider>
  )
  return calls
}

it("blocks Publish and explains a failing pair", async () => {
  setup(docFor({ site: { tokens: { "text-muted": "#dddddd" } } }))
  expect(
    await screen.findByText("Publishing is blocked until every pair passes.")
  ).toBeTruthy()
  expect(
    screen.getAllByText(/Muted text on Cream is \d\.\d{2}:1/).length
  ).toBeGreaterThan(0)
  expect(
    (screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement)
      .disabled
  ).toBe(true)
})

it("Fix all clears the issues and saves the draft", async () => {
  const calls = setup(docFor({ site: { tokens: { "text-muted": "#dddddd" } } }))
  await userEvent.click(await screen.findByRole("button", { name: "Fix all" }))
  await waitFor(() =>
    expect(calls.some((c) => c.url.endsWith("/theme/draft"))).toBe(true)
  )
  expect(
    screen.queryByText("Publishing is blocked until every pair passes.")
  ).toBeNull()
})

it("choosing a preset updates the draft", async () => {
  const calls = setup(docFor({}))
  await userEvent.click(await screen.findByRole("button", { name: /Ocean/ }))
  await waitFor(() => {
    const save = calls.find((c) => c.url.endsWith("/theme/draft"))
    expect(save?.body).toMatchObject({ draft: { site: { preset: "ocean" } } })
  })
})

it("publishes with the current version", async () => {
  const calls = setup(docFor({ site: { brand: "#2f5f8a" } }))
  await userEvent.click(await screen.findByRole("button", { name: "Publish" }))
  await waitFor(() =>
    expect(calls.find((c) => c.url.endsWith("/theme/publish"))?.body).toEqual({
      version: 3,
    })
  )
})
