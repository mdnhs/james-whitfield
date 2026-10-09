import { expect, it } from "vitest"

import { toMePayload } from "./me"

it("maps an actor to the /me payload with merged permissions", () => {
  const payload = toMePayload({
    userId: "u1",
    email: "v@example.com",
    name: "Vera Viewer",
    roles: ["viewer"],
    twoFactorEnabled: false,
    impersonatedBy: null,
  })
  expect(payload).toEqual({
    user: { id: "u1", email: "v@example.com", name: "Vera Viewer" },
    roles: ["viewer"],
    permissions: expect.objectContaining({ page: ["read"] }),
    twoFactorEnabled: false,
    impersonatedBy: null,
  })
  expect(payload.permissions.lead).toBeUndefined()
})
