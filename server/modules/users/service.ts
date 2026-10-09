import "server-only"

import { APIError } from "better-auth/api"
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

const DUPLICATE_MESSAGE = "Someone with that email already has an account"

// A concurrent invite can slip past the pre-check: Better Auth reports the
// duplicate as an APIError, or Postgres as a unique violation (23505).
export function isDuplicateUserError(error: unknown): boolean {
  if (error instanceof APIError) {
    const code = (error.body as { code?: string } | undefined)?.code
    return typeof code === "string" && code.startsWith("USER_ALREADY_EXISTS")
  }
  for (
    let e: unknown = error, i = 0;
    e && i < 5;
    i++, e = (e as { cause?: unknown }).cause
  ) {
    if ((e as { code?: unknown }).code === "23505") return true
  }
  return false
}

// How the account is being created. `headers` carries the acting user's
// request so Better Auth applies RBAC. `system` skips that check and the
// owner guard: ONLY the trusted CLI owner bootstrap (Task 1.8) may use it.
export type ProvisionContext = { headers: Headers } | { as: "system" }

// Creates an account without a password, then emails the reset link as an
// invitation (docs/brief.md §7.4). Emails are matched case-insensitively.
export async function provisionUser(
  input: InviteInput,
  context: ProvisionContext
) {
  const email = input.email.trim().toLowerCase()
  const existing = await getDb().query.users.findFirst({
    where: eq(users.email, email),
  })
  if (existing) throw new ApiError("CONFLICT", DUPLICATE_MESSAGE)

  const auth = getAuth()
  let user
  try {
    ;({ user } = await auth.api.createUser({
      body: { email, name: input.name, role: input.role },
      headers: "headers" in context ? context.headers : undefined,
    }))
  } catch (error) {
    if (isDuplicateUserError(error))
      throw new ApiError("CONFLICT", DUPLICATE_MESSAGE)
    throw error
  }
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

  const user = await provisionUser(input, { headers })
  await audit(actor, {
    action: "user.invite",
    entityType: "user",
    entityId: user.id,
    summary: `Invited ${user.email} as ${input.role}`,
  })

  return { id: user.id, email: user.email, name: user.name, role: input.role }
}
