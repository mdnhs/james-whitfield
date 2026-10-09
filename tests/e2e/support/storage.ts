import path from "node:path"

// Written by tests/e2e/admin/auth.setup.ts (the "setup" project) before any
// other project runs. Specs that use a state must never sign out of it.
const dir = path.join(import.meta.dirname, "../.auth")

export const STORAGE = {
  editor: path.join(dir, "editor.json"),
  intake: path.join(dir, "intake.json"),
  viewer: path.join(dir, "viewer.json"),
  owner: path.join(dir, "owner.json"),
  account: path.join(dir, "account.json"),
} as const
