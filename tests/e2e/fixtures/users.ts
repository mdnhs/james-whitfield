// Seeded by `pnpm e2e:seed`. Plain data: the seed script imports it too.
export const PASSWORD = "e2e-password-0123"

export const E2E_USERS = {
  editor: { email: "editor@e2e.test", name: "Eddie Editor", role: "editor" },
  // Never sets up two-factor: proves the panel and API refuse it.
  owner: { email: "owner@e2e.test", name: "Olive Owner", role: "owner" },
  // Only the two-factor spec uses (and changes) this account.
  twoFactorOwner: {
    email: "owner-2fa@e2e.test",
    name: "Tess Twofactor",
    role: "owner",
  },
  // Only the password-reset spec uses (and changes) this account.
  resetter: { email: "reset@e2e.test", name: "Rita Reset", role: "viewer" },
  // Shared, read-only sessions for the shell specs (tests/e2e/admin/auth.setup.ts).
  intake: { email: "intake@e2e.test", name: "Ivy Intake", role: "intake" },
  viewer: { email: "viewer@e2e.test", name: "Vera Viewer", role: "viewer" },
  // An owner the setup project enrols in 2FA; never signs out.
  shellOwner: {
    email: "owner-shell@e2e.test",
    name: "Sam Shell",
    role: "owner",
  },
  // Only the handover spec signs this one in, sets up 2FA and signs out.
  handoverOwner: {
    email: "owner-handover@e2e.test",
    name: "Hana Handover",
    role: "owner",
  },
  // Only the account spec changes this one (name, sessions).
  accountUser: {
    email: "account@e2e.test",
    name: "Andy Account",
    role: "editor",
  },
} as const

export type E2EUser = (typeof E2E_USERS)[keyof typeof E2E_USERS]
