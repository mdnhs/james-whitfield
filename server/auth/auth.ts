import "server-only"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, twoFactor } from "better-auth/plugins"

import { ac, roles } from "@/lib/auth/permissions"
import { getDb } from "@/server/db/client"
import * as schema from "@/server/db/schema"
import { getEnv } from "@/server/env"
import { sendEmail } from "@/server/lib/email"
import { inviteEmail, passwordResetEmail } from "@/server/lib/email/templates"

// Invites reuse the reset flow (docs/brief.md §7.4). Their redirect target
// carries ?invite=1, so the email can be worded as an invitation.
const isInviteLink = (url: string) =>
  decodeURIComponent(url).includes("invite=1")

export function buildAuth() {
  const env = getEnv()
  return betterAuth({
    appName: "Magda Kennedy Admin",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.SITE_URL],
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
      usePlural: true,
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      // Accounts exist only through invitation.
      disableSignUp: true,
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60 * 24,
      sendResetPassword: async ({ user, url }) => {
        const message = isInviteLink(url)
          ? inviteEmail({ name: user.name, url })
          : passwordResetEmail({ name: user.name, url })
        // Not awaited (avoids a timing side channel); failures are logged.
        void sendEmail({ to: user.email, ...message }).catch((error) =>
          console.error("[auth] could not send email", error)
        )
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      // Cheap reads for the UI. Admin checks bypass it (disableCookieCache).
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
      // On for staging and production. Local and E2E runs sign in many times.
      enabled: env.SITE_ENV !== "development",
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
        "/two-factor/*": { window: 60, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: "mk",
      database: { generateId: "uuid" },
      // Behind Traefik on Dokploy; X-Forwarded-For chains are not trusted.
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    },
    plugins: [
      admin({
        ac,
        roles,
        defaultRole: "viewer",
        adminRoles: ["owner", "admin"],
        impersonationSessionDuration: 60 * 60,
      }),
      twoFactor({ issuer: "Magda Kennedy Admin" }),
    ],
  })
}

export type Auth = ReturnType<typeof buildAuth>

let instance: Auth | undefined

// Built on first use: importing this module at build time needs no secrets.
export function getAuth(): Auth {
  instance ??= buildAuth()
  return instance
}
