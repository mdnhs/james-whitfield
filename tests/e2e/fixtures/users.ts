// Seeded by `pnpm e2e:seed`. Plain data: the seed script imports it too.
export const PASSWORD = "e2e-password-0123"

export const E2E_USERS = {
  editor: { email: "editor@e2e.test", name: "Eddie Editor", role: "editor" },
  owner: { email: "owner@e2e.test", name: "Olive Owner", role: "owner" },
  // Only the password-reset spec uses (and changes) this account.
  resetter: { email: "reset@e2e.test", name: "Rita Reset", role: "viewer" },
} as const

export type E2EUser = (typeof E2E_USERS)[keyof typeof E2E_USERS]
