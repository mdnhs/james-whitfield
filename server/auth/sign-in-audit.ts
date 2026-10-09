import "server-only"

import type { BetterAuthPlugin } from "better-auth"
import { createAuthMiddleware } from "better-auth/api"

import { audit } from "@/server/lib/audit"

// Completing a sign-in, not creating a session, is what lands in the audit
// log: the password step of a 2FA sign-in creates a session and the
// two-factor plugin deletes it again, and enabling or disabling 2FA rotates
// the session. A plugin, listed after twoFactor, so its after-hook runs once
// the two-factor plugin has swapped a pending sign-in for its challenge
// (`newSession` is then null).
const SECOND_FACTOR_PATHS = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/two-factor/verify-otp",
])

export const signInAudit = () =>
  ({
    id: "sign-in-audit",
    hooks: {
      after: [
        {
          matcher: ({ path = "" }) =>
            path === "/sign-in/email" || SECOND_FACTOR_PATHS.has(path),
          handler: createAuthMiddleware(async (ctx) => {
            const created = ctx.context.newSession
            if (!created) return
            // A second factor verified on a signed-in session is enrolment
            // (or a re-check), not a sign-in.
            if (SECOND_FACTOR_PATHS.has(ctx.path) && ctx.context.session) return
            await audit(
              {
                userId: created.user.id,
                email: created.user.email,
                ip: created.session.ipAddress ?? null,
                userAgent: created.session.userAgent ?? null,
              },
              {
                action: "auth.sign_in",
                entityType: "user",
                entityId: created.user.id,
                summary: "Signed in",
              }
            )
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin
