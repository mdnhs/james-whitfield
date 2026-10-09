import "server-only"

import { eq } from "drizzle-orm"

import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getAuth } from "@/server/auth/auth"
import { getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"
import { getEnv } from "@/server/env"
import { audit } from "@/server/lib/audit"

import type { InviteInput } from "./schema"

export function inviteRedirect() {
  return new URL("/admin/reset-password?invite=1", getEnv().SITE_URL).toString()
}

// Creates an account without a password, then emails the reset link as an
// invitation (docs/brief.md §7.4). Shared with the owner bootstrap. Pass the
// acting user's headers so Better Auth applies RBAC; omit them for trusted
// server-side callers. Emails are matched case-insensitively.
export async function provisionUser(input: InviteInput, headers?: Headers) {
  const email = input.email.trim().toLowerCase()
  const existing = await getDb().query.users.findFirst({
    where: eq(users.email, email),
  })
  if (existing) {
    throw new ApiError(
      "CONFLICT",
      "Someone with that email already has an account"
    )
  }

  const auth = getAuth()
  const { user } = await auth.api.createUser({
    body: { email, name: input.name, role: input.role },
    headers,
  })
  await auth.api.requestPasswordReset({
    body: { email, redirectTo: inviteRedirect() },
  })
  return user
}

// Only an owner may create another owner.
export async function inviteUser(
  actor: Actor,
  input: InviteInput,
  headers: Headers
) {
  if (input.role === "owner" && !actor.roles.includes("owner")) {
    throw new ApiError("FORBIDDEN", "Only an owner can invite another owner")
  }

  const user = await provisionUser(input, headers)
  await audit(actor, {
    action: "user.invite",
    entityType: "user",
    entityId: user.id,
    summary: `Invited ${user.email} as ${input.role}`,
  })

  return { id: user.id, email: user.email, name: user.name, role: input.role }
}
