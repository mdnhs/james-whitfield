// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { expect, it } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"

import { AccountView } from "./account-view"

const viewingAs: MePayload = {
  user: { id: "u1", email: "eddie@example.com", name: "Eddie Editor" },
  roles: ["editor"],
  permissions: {},
  twoFactorEnabled: false,
  impersonatedBy: "owner-id",
}

// The server refuses these changes during View-as (403
// IMPERSONATION_READ_ONLY); the page says so instead of offering forms.
it("shows a notice instead of the forms during View-as", () => {
  render(
    <NuqsTestingAdapter searchParams="?tab=security">
      <AdminActorProvider value={viewingAs}>
        <AccountView />
      </AdminActorProvider>
    </NuqsTestingAdapter>
  )
  expect(screen.getByText("You're viewing as Eddie Editor")).toBeTruthy()
  expect(screen.queryByRole("tab")).toBeNull()
  expect(screen.queryByRole("button", { name: "Change password" })).toBeNull()
  expect(screen.queryByLabelText("Full name")).toBeNull()
})
