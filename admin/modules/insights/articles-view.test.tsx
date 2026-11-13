// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { beforeEach, describe, expect, it, vi } from "vitest"

const publish = vi.fn()
const unpublish = vi.fn()
const del = vi.fn()
const push = vi.fn()
const perms: { allowed: Set<string> | null } = { allowed: null }

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("@/admin/lib/actor-context", async (orig) => ({
  ...(await orig<typeof import("@/admin/lib/actor-context")>()),
  usePermission: (p: { article?: string[] }) =>
    perms.allowed === null ||
    (p.article ?? []).every((a) => perms.allowed!.has(a)),
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock("@/admin/lib/api", () => ({
  articlesApi: {
    ":id": {
      publish: { $post: async (a: unknown) => publish(a) },
      unpublish: { $post: async (a: unknown) => unpublish(a) },
      $delete: async (a: unknown) => del(a),
    },
  },
  parseResponse: (p: Promise<unknown>) => p,
}))

const row = (
  id: string,
  title: string,
  status: "draft" | "published",
  version: number
) => ({
  id,
  title,
  slug: id,
  liveSlug: id,
  status,
  version,
  featured: false,
  category: "Coaching",
  author: "Magda",
  updatedAt: "2026-10-09T18:36:00.000Z",
  publishedAt: null,
  scheduledFor: null,
  reviewRequestedAt: null,
})

vi.mock("./queries", () => ({
  articlesListQuery: () => ({
    queryKey: ["articles", "list"],
    queryFn: async () => ({
      items: [
        row("a", "Why calm is a skill", "published", 4),
        row("b", "A wind-down routine", "draft", 2),
      ],
      page: 1,
      pageSize: 25,
      total: 2,
    }),
  }),
  categoriesQuery: () => ({
    queryKey: ["categories"],
    queryFn: async () => ({ items: [] }),
  }),
  authorsQuery: () => ({
    queryKey: ["authors"],
    queryFn: async () => ({ items: [] }),
  }),
}))

const { ArticlesView } = await import("./articles-view")

function renderView() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <NuqsTestingAdapter>
      <QueryClientProvider client={client}>
        <ArticlesView />
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

beforeEach(() => {
  perms.allowed = null
  for (const fn of [publish, unpublish, del, push]) fn.mockReset()
})

describe("Insights row actions (like Services)", () => {
  it("shows a live switch, Edit and Delete for every article", async () => {
    renderView()
    const live = (
      await screen.findAllByRole("switch", {
        name: "Publish Why calm is a skill",
      })
    )[0]!
    expect(live.getAttribute("aria-checked")).toBe("true")
    expect(
      screen
        .getAllByRole("switch", { name: "Publish A wind-down routine" })[0]!
        .getAttribute("aria-checked")
    ).toBe("false")
    expect(
      screen.getAllByRole("button", { name: "Edit Why calm is a skill" }).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole("button", { name: "Delete A wind-down routine" })
        .length
    ).toBeGreaterThan(0)
  })

  it("the switch publishes a draft and unpublishes a live article with the row's version", async () => {
    renderView()
    await userEvent.click(
      (
        await screen.findAllByRole("switch", {
          name: "Publish A wind-down routine",
        })
      )[0]!
    )
    await waitFor(() =>
      expect(publish).toHaveBeenCalledWith({
        param: { id: "b" },
        json: { version: 2 },
      })
    )
    await userEvent.click(
      screen.getAllByRole("switch", { name: "Publish Why calm is a skill" })[0]!
    )
    await waitFor(() =>
      expect(unpublish).toHaveBeenCalledWith({
        param: { id: "a" },
        json: { version: 4, archive: false, redirectTo: "/insights" },
      })
    )
  })

  it("Edit opens the editor; Delete asks first, then deletes", async () => {
    renderView()
    await userEvent.click(
      (
        await screen.findAllByRole("button", {
          name: "Edit Why calm is a skill",
        })
      )[0]!
    )
    expect(push).toHaveBeenCalledWith("/admin/insights/a")
    await userEvent.click(
      screen.getAllByRole("button", { name: "Delete A wind-down routine" })[0]!
    )
    expect(del).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }))
    await waitFor(() =>
      expect(del).toHaveBeenCalledWith({ param: { id: "b" } })
    )
  })

  it("without publish or delete rights the switch is disabled and Delete is hidden", async () => {
    perms.allowed = new Set(["read", "update", "create"])
    renderView()
    const sw = (
      await screen.findAllByRole("switch", {
        name: "Publish Why calm is a skill",
      })
    )[0]!
    expect(
      sw.hasAttribute("disabled") || sw.getAttribute("aria-disabled") === "true"
    ).toBe(true)
    expect(screen.queryAllByRole("button", { name: /^Delete / })).toHaveLength(
      0
    )
  })
})
