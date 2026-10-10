// @vitest-environment jsdom
import { act, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({ pathname: "/" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }))
vi.mock("next/script", () => ({
  default: (props: {
    id: string
    src?: string
    strategy: string
    children?: string
  }) => (
    <script
      data-testid={props.id}
      data-strategy={props.strategy}
      data-src={props.src}
    >
      {props.children}
    </script>
  ),
}))

import { saveConsent } from "@/lib/tracking/consent-client"

import { CustomScripts } from "./custom-scripts"

const snippet = (over: Record<string, unknown>) => ({
  name: "s",
  placement: "body" as const,
  src: "",
  inline: "window.x=1",
  category: "necessary" as const,
  routes: [] as string[],
  enabled: true,
  ...over,
})

beforeEach(() => {
  nav.pathname = "/"
  ;(window as never as { __mkConsent: unknown }).__mkConsent = null
})

describe("CustomScripts (brief §12.6)", () => {
  it("runs necessary snippets without consent, with the placement's strategy", () => {
    const { container } = render(
      <CustomScripts
        snippets={[
          snippet({ placement: "head" }),
          snippet({ placement: "body", inline: "window.y=1" }),
        ]}
      />
    )
    const scripts = [...container.querySelectorAll("script")]
    expect(scripts.map((s) => s.dataset.strategy)).toEqual([
      "afterInteractive",
      "lazyOnload",
    ])
  })

  it("waits for the snippet's own consent category", () => {
    const { container } = render(
      <CustomScripts
        snippets={[
          snippet({ category: "analytics" }),
          snippet({ category: "marketing", inline: "window.m=1" }),
        ]}
      />
    )
    expect(container.querySelectorAll("script")).toHaveLength(0)
    act(() => {
      saveConsent(
        { analytics: true, marketing: false },
        "custom",
        {
          version: 1,
          months: 6,
        },
        {
          window: window as never,
          doc: { cookie: "" },
          reload: () => undefined,
          now: Date.now,
          newId: () => "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc",
        }
      )
    })
    const scripts = [...container.querySelectorAll("script")]
    expect(scripts.map((s) => s.textContent)).toEqual(["window.x=1"])
  })

  it("only runs on matching routes", () => {
    nav.pathname = "/about"
    const { container } = render(
      <CustomScripts snippets={[snippet({ routes: ["/insights/*"] })]} />
    )
    expect(container.querySelectorAll("script")).toHaveLength(0)
  })
})
