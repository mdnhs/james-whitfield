// @vitest-environment jsdom
import { renderHook } from "@testing-library/react"
import { expect, it } from "vitest"

import { toMePayload } from "@/lib/auth/me"

import { AdminActorProvider, useActor, usePermission } from "./actor-context"

const viewer = toMePayload({
  userId: "u1",
  email: "v@example.com",
  name: "Vera Viewer",
  roles: ["viewer"],
  twoFactorEnabled: false,
  impersonatedBy: null,
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AdminActorProvider value={viewer}>{children}</AdminActorProvider>
)

it("answers permission checks for the signed-in actor", () => {
  const read = renderHook(() => usePermission({ page: ["read"] }), { wrapper })
  const write = renderHook(() => usePermission({ page: ["update"] }), {
    wrapper,
  })
  expect(read.result.current).toBe(true)
  expect(write.result.current).toBe(false)
})

it("exposes the /me payload", () => {
  const { result } = renderHook(() => useActor(), { wrapper })
  expect(result.current.user.name).toBe("Vera Viewer")
})

it("fails loudly outside the provider", () => {
  expect(() => renderHook(() => useActor())).toThrow(/AdminActorProvider/)
})
