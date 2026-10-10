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

describe("public paths (Ruling R2)", () => {
  const answer = (body: unknown, status = 200) =>
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))
    )
  afterEach(() => vi.unstubAllGlobals())

  it("rewrites a missing CMS path to the global 404 with a 404 status", async () => {
    answer({ kind: "missing" })
    const res = await proxy(request("/no-such-page"))
    expect(res.status).toBe(404)
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/_missing/page"
    )
  })

  it("redirects with the stored status and keeps the query string", async () => {
    answer({ kind: "redirect", destination: "/insights/new", statusCode: 301 })
    const res = await proxy(request("/insights/old?utm_source=x&_rsc=abc"))
    expect(res.status).toBe(301)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/insights/new?utm_source=x"
    )
  })

  it("keeps a destination's own query string", async () => {
    answer({
      kind: "redirect",
      destination: "/contact?plan=a",
      statusCode: 302,
    })
    const res = await proxy(request("/book?x=1"))
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/contact?plan=a"
    )
  })

  it("never redirects off-site", async () => {
    for (const destination of [
      "//evil.example",
      "/\\evil.example",
      "https://evil.example",
      "/\t/evil",
    ]) {
      answer({ kind: "redirect", destination, statusCode: 301 })
      const res = await proxy(request("/old"))
      expect(res.headers.get("location")).toBeNull()
      expect(res.headers.get("x-middleware-next")).toBe("1")
    }
  })

  it("asks the loopback resolver without following redirects", async () => {
    answer({ kind: "live" })
    await proxy(request("/insights/old"))
    const [url, init] = (
      fetch as unknown as { mock: { calls: [URL, RequestInit][] } }
    ).mock.calls[0]!
    expect(String(url)).toBe(
      "http://127.0.0.1:3000/api/v1/resolve?path=%2Finsights%2Fold"
    )
    expect(init.redirect).toBe("manual")
  })

  it("keeps an encoded-tab destination on this origin", async () => {
    answer({
      kind: "redirect",
      destination: "/%09/evil.example",
      statusCode: 301,
    })
    const res = await proxy(request("/old"))
    expect(new URL(res.headers.get("location")!).origin).toBe(
      "http://localhost:3000"
    )
  })

  it.each([200, 303, 404, "301", null])(
    "ignores a status code of %s",
    async (statusCode) => {
      answer({ kind: "redirect", destination: "/about", statusCode })
      const res = await proxy(request("/old"))
      expect(res.headers.get("location")).toBeNull()
      expect(res.headers.get("x-middleware-next")).toBe("1")
    }
  )

  it("answers HEAD like GET", async () => {
    answer({ kind: "redirect", destination: "/about", statusCode: 308 })
    const head = new NextRequest(new URL("/old", "http://localhost:3000"), {
      method: "HEAD",
    })
    expect((await proxy(head)).status).toBe(308)
  })

  it("lets live and pass-through paths continue", async () => {
    for (const kind of ["live", "pass"]) {
      answer({ kind })
      expect(
        (await proxy(request("/about"))).headers.get("x-middleware-next")
      ).toBe("1")
    }
  })

  it("skips the resolver in draft mode (Review Focus 1)", async () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const res = await proxy(request("/team", "__prerender_bypass=x"))
    expect(fetch).not.toHaveBeenCalled()
    expect(res.headers.get("x-middleware-next")).toBe("1")
  })

  it("only asks for GET and HEAD", async () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const post = new NextRequest(new URL("/contact", "http://localhost:3000"), {
      method: "POST",
    })
    expect((await proxy(post)).headers.get("x-middleware-next")).toBe("1")
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ["a timeout", () => Promise.reject(new DOMException("t", "TimeoutError"))],
    ["a 500", () => Promise.resolve(new Response("x", { status: 500 }))],
    [
      "malformed JSON",
      () => Promise.resolve(new Response("{", { status: 200 })),
    ],
    [
      "an unknown kind",
      () => Promise.resolve(new Response('{"kind":"x"}', { status: 200 })),
    ],
  ])("fails open on %s (Review Focus 2)", async (_name, impl) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(impl))
    const res = await proxy(request("/no-such-page"))
    expect(res.status).toBe(200)
    expect(res.headers.get("x-middleware-next")).toBe("1")
  })

  it("never resolves admin paths", async () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    await proxy(request("/admin/pages", "mk.session_token=abc"))
    expect(fetch).not.toHaveBeenCalled()
  })
})
