// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

const theme = vi.hoisted(() => ({ value: {} as unknown }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  io: async () => {},
}))
vi.mock("@/server/modules/content/queries", async () => {
  const { ThemeConfig } = await import("@/lib/theme/schema")
  return { getThemeConfig: async () => ThemeConfig.parse(theme.value) }
})
const mode = vi.hoisted(() => ({ value: null as null | string }))
vi.mock("./default-mode", () => ({
  DefaultMode: (props: { mode: string }) => {
    mode.value = props.mode
    return null
  },
}))
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }))

import { AdminFrame } from "./admin-frame"

afterEach(cleanup)

it("emits no style for the Evergreen default", async () => {
  theme.value = {}
  const { container } = render(await AdminFrame({ children: <p>x</p> }))
  expect(container.querySelector("style#theme-tokens")).toBeNull()
  expect(mode.value).toBe("system")
})

it("emits the admin scopes and passes the default mode to the client", async () => {
  theme.value = { admin: { primary: "#2f5f8a", mode: "dark" } }
  const { container } = render(await AdminFrame({ children: <p>x</p> }))
  const css = container.querySelector("style#theme-tokens")?.textContent
  expect(css).toMatch(/^:root\[data-theme="admin"\]\{/)
  expect(css).toContain(':root[data-theme="admin"].dark{')
  expect(mode.value).toBe("dark")
})
