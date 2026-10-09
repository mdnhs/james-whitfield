import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthFormSkeleton, AuthHeader } from "@/admin/modules/auth/auth-header"
import { SignOutLink } from "@/admin/modules/auth/sign-out-link"
import { TwoFactorSetup } from "@/admin/modules/auth/two-factor-setup"
import { TWO_FACTOR_SETUP_PATH, requireSignedIn } from "@/server/auth/session"

export const metadata: Metadata = { title: "Set up two-factor" }

export default function TwoFactorSetupPage() {
  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        title="Protect your account"
        description="Your role can change who has access, so two-factor authentication is required."
      />
      <Suspense fallback={<AuthFormSkeleton />}>
        <Gate />
      </Suspense>
    </div>
  )
}

// Signed in, but deliberately not behind requireActor's 2FA enforcement:
// this is where that enforcement sends people.
async function Gate() {
  const actor = await requireSignedIn(TWO_FACTOR_SETUP_PATH)
  if (actor.twoFactorEnabled) redirect("/admin")
  return (
    <>
      <TwoFactorSetup />
      <SignOutLink />
    </>
  )
}
