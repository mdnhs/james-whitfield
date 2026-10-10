import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import { proxy } from "./proxy"

const request = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie } : {},
  })

describe("proxy", () => {
  it("sends signed-out visitors to sign-in with a return path", async () => {
    const response = await proxy(request("/admin/pages?tab=draft"))
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/admin/sign-in?next=%2Fadmin%2Fpages%3Ftab%3Ddraft"
    )
  })

  it("lets a request with a session cookie through", async () => {
    const response = await proxy(request("/admin", "mk.session_token=abc"))
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("recognises the production __Secure- cookie", async () => {
    const response = await proxy(
      request("/admin", "__Secure-mk.session_token=abc")
    )
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("keeps the auth pages public", async () => {
    expect(
      (await proxy(request("/admin/forgot-password"))).headers.get("location")
    ).toBeNull()
    expect(
      (await proxy(request("/admin/reset-password?token=t"))).headers.get(
        "location"
      )
    ).toBeNull()
  })

  it("does not redirect sign-in, even with a session cookie", async () => {
    const response = await proxy(
      request("/admin/sign-in", "mk.session_token=abc")
    )
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("marks every admin response noindex", async () => {
    expect(
      (await proxy(request("/admin/sign-in"))).headers.get("x-robots-tag")
    ).toBe("noindex, nofollow")
    expect(
      (await proxy(request("/admin/pages"))).headers.get("x-robots-tag")
    ).toBe("noindex, nofollow")
  })

  it("keeps /admin/two-factor public but gates look-alike paths", async () => {
    expect(
      (await proxy(request("/admin/two-factor"))).headers.get("location")
    ).toBeNull()
    const gated = await proxy(request("/admin/two-factor-setup"))
    expect(gated.status).toBe(307)
    expect(gated.headers.get("location")).toBe(
      "http://localhost:3000/admin/sign-in?next=%2Fadmin%2Ftwo-factor-setup"
    )
  })

  it("sends no Referer from the reset page, whose URL holds a token", async () => {
    expect(
      (await proxy(request("/admin/reset-password?token=t"))).headers.get(
        "referrer-policy"
      )
    ).toBe("no-referrer")
    expect(
      (await proxy(request("/admin/sign-in"))).headers.get("referrer-policy")
    ).toBeNull()
  })

  it("forwards the requested path to the app for requireActor", async () => {
    const response = await proxy(
      request("/admin/pages?tab=draft&_rsc=abc", "mk.session_token=abc")
    )
    expect(response.headers.get("x-middleware-override-headers")).toContain(
      "x-mk-admin-path"
    )
    expect(response.headers.get("x-middleware-request-x-mk-admin-path")).toBe(
      "/admin/pages?tab=draft"
    )
  })

  it("overwrites a client-supplied admin path header", async () => {
    const forged = new NextRequest(new URL("http://localhost:3000/admin"), {
      headers: {
        cookie: "mk.session_token=abc",
        "x-mk-admin-path": "https://evil.example",
      },
    })
    expect(
      (await proxy(forged)).headers.get("x-middleware-request-x-mk-admin-path")
    ).toBe("/admin")
  })

  it("leaves Next's _rsc parameter out of the return path", async () => {
    expect(
      (await proxy(request("/admin/pages?_rsc=abc"))).headers.get("location")
    ).toBe("http://localhost:3000/admin/sign-in?next=%2Fadmin%2Fpages")
  })
})

describe("article redirects (Ruling R1)", () => {
  afterEach(() => vi.unstubAllGlobals())
  const at = (path: string, method = "GET") =>
    new NextRequest(new URL(path, "http://localhost:3000"), { method })
  const stub = (body: unknown, status = 200) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(body, { status }))
    )

  it("answers a 301 from the resolver for /insights/:slug", async () => {
    stub({ destination: "/insights/new", statusCode: 301 })
    const res = await proxy(at("/insights/old"))
    expect(res.status).toBe(301)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/insights/new"
    )
    const [url, init] = (
      fetch as unknown as { mock: { calls: [URL, RequestInit][] } }
    ).mock.calls[0]!
    expect(String(url)).toBe(
      "http://127.0.0.1:3000/api/v1/redirects?path=%2Finsights%2Fold"
    )
    expect(init.redirect).toBe("manual")
  })

  it.each([
    ["no match", async () => new Response(null, { status: 204 })],
    [
      "resolver down",
      async () => {
        throw new Error("ECONNREFUSED")
      },
    ],
  ])("passes through on %s", async (_, impl) => {
    vi.stubGlobal("fetch", vi.fn(impl))
    const res = await proxy(at("/insights/live"))
    expect(res.headers.get("x-middleware-next")).toBe("1")
  })

  it.each(["https://evil.example/x", "//evil.example", "/\\evil.example"])(
    "ignores an off-site destination %s",
    async (destination) => {
      stub({ destination, statusCode: 301 })
      const res = await proxy(at("/insights/old"))
      expect(res.headers.get("x-middleware-next")).toBe("1")
      expect(res.headers.get("location")).toBeNull()
    }
  )

  it.each([200, 303, 404, "301", null])(
    "ignores a status code of %s",
    async (statusCode) => {
      stub({ destination: "/insights/new", statusCode })
      const res = await proxy(at("/insights/old"))
      expect(res.headers.get("x-middleware-next")).toBe("1")
      expect(res.headers.get("location")).toBeNull()
    }
  )

  it("only consults the resolver for GET and HEAD", async () => {
    stub({ destination: "/insights/new", statusCode: 301 })
    const post = await proxy(at("/insights/old", "POST"))
    expect(post.headers.get("x-middleware-next")).toBe("1")
    expect(fetch).not.toHaveBeenCalled()
    expect((await proxy(at("/insights/old", "HEAD"))).status).toBe(301)
  })

  it("never asks for admin or deeper paths", async () => {
    vi.stubGlobal("fetch", vi.fn())
    await proxy(at("/insights/a/b"))
    expect(fetch).not.toHaveBeenCalled()
  })
})
