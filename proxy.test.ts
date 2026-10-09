import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { proxy } from "./proxy"

const request = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie } : {},
  })

describe("proxy", () => {
  it("sends signed-out visitors to sign-in with a return path", () => {
    const response = proxy(request("/admin/pages?tab=draft"))
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/admin/sign-in?next=%2Fadmin%2Fpages%3Ftab%3Ddraft"
    )
  })

  it("lets a request with a session cookie through", () => {
    const response = proxy(request("/admin", "mk.session_token=abc"))
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("recognises the production __Secure- cookie", () => {
    const response = proxy(request("/admin", "__Secure-mk.session_token=abc"))
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("keeps the auth pages public", () => {
    expect(
      proxy(request("/admin/forgot-password")).headers.get("location")
    ).toBeNull()
    expect(
      proxy(request("/admin/reset-password?token=t")).headers.get("location")
    ).toBeNull()
  })

  it("does not redirect sign-in, even with a session cookie", () => {
    const response = proxy(request("/admin/sign-in", "mk.session_token=abc"))
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("marks every admin response noindex", () => {
    expect(proxy(request("/admin/sign-in")).headers.get("x-robots-tag")).toBe(
      "noindex, nofollow"
    )
    expect(proxy(request("/admin/pages")).headers.get("x-robots-tag")).toBe(
      "noindex, nofollow"
    )
  })
})
