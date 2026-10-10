import "server-only"

import { eq, or } from "drizzle-orm"

import { parseRoles } from "@/lib/auth/permissions"
import { getAuth } from "@/server/auth/auth"
import { getDb } from "@/server/db/client"
import { sessions, twoFactors, users } from "@/server/db/schema"
import { getEnv } from "@/server/env"
import { audit } from "@/server/lib/audit"

export class RecoveryError extends Error {}

// Ruling R16 (docs/brief.md §19 "Owner lockout"): an owner who lost their
// two-factor device and backup codes, or who is banned, gets a clean start.
// Command line only: whoever runs it already controls the server.
export async function recoverOwner(rawEmail: string) {
  const email = rawEmail.trim().toLowerCase()
  const user = await getDb().query.users.findFirst({
    where: eq(users.email, email),
  })
  if (!user) {
    throw new RecoveryError(
      `No account uses ${email}. To create the first owner, run admin-create instead.`
    )
  }
  if (!parseRoles(user.role).includes("owner")) {
    throw new RecoveryError(
      `${email} is not an owner. An owner or admin can fix this account in Users & roles.`
    )
  }
  const sessionsEnded = await getDb().transaction(async (tx) => {
    await tx.delete(twoFactors).where(eq(twoFactors.userId, user.id))
    await tx
      .update(users)
      .set({
        twoFactorEnabled: false,
        banned: false,
        banReason: null,
        banExpires: null,
      })
      .where(eq(users.id, user.id))
    const ended = await tx
      .delete(sessions)
      .where(
        or(eq(sessions.userId, user.id), eq(sessions.impersonatedBy, user.id))
      )
      .returning({ id: sessions.id })
    await audit(
      null,
      {
        action: "user.recover",
        entityType: "user",
        entityId: user.id,
        summary: `Recovered owner ${email} from the command line (two-factor reset, signed out everywhere)`,
      },
      tx
    )
    return ended.length
  })
  await getAuth().api.requestPasswordReset({
    body: {
      email,
      redirectTo: new URL(
        "/admin/reset-password",
        getEnv().SITE_URL
      ).toString(),
    },
  })
  return { userId: user.id, sessionsEnded }
}
