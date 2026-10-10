import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthFormSkeleton, AuthHeader } from "@/admin/modules/auth/auth-header"
import { TwoFactorSetup } from "@/admin/modules/auth/two-factor-setup"
import {
  roleRecommendsTwoFactor,
  SECURITY_SETTINGS_PATH,
  TWO_FACTOR_SETUP_PATH,
} from "@/lib/auth/two-factor-policy"
import { requireActor } from "@/server/auth/session"

export const metadata: Metadata = { title: "Set up two-factor" }

const TITLE = "Protect your account"

export default function TwoFactorSetupPage() {
  return (
    <div className="flex flex-col gap-8">
      <Suspense
        fallback={
          <>
            <AuthHeader title={TITLE} />
            <AuthFormSkeleton />
          </>
        }
      >
        <Gate />
      </Suspense>
    </div>
  )
}

// The optional enrolment flow, opened from Account ▸ Security. Two-factor
// is optional for every role (change 2026-10-11): nobody is sent here, and
// anyone can go back without finishing.
async function Gate() {
  const actor = await requireActor(TWO_FACTOR_SETUP_PATH)
  if (actor.twoFactorEnabled) redirect(SECURITY_SETTINGS_PATH)
  return (
    <>
      <AuthHeader
        title={TITLE}
        description={
          roleRecommendsTwoFactor(actor.roles)
            ? "Your role can change who has access, so two-factor authentication is strongly recommended: a code from your phone keeps your account safe even if your password leaks."
            : "Two-factor authentication is recommended: a code from your phone keeps your account safe even if your password leaks."
        }
      />
      <TwoFactorSetup />
      <p className="text-sm text-muted-foreground">
        Not a good time?{" "}
        <Link
          href={SECURITY_SETTINGS_PATH}
          className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Back to your account
        </Link>
      </p>
    </>
  )
}
