import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthFormSkeleton, AuthHeader } from "@/admin/modules/auth/auth-header"
import { SignOutLink } from "@/admin/modules/auth/sign-out-link"
import { TwoFactorSetup } from "@/admin/modules/auth/two-factor-setup"
import { roleRequiresTwoFactor } from "@/lib/auth/two-factor-policy"
import { TWO_FACTOR_SETUP_PATH, requireSignedIn } from "@/server/auth/session"

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

// Signed in, but deliberately not behind requireActor's 2FA enforcement:
// this is where that enforcement sends people. Only roles the two-factor
// policy covers are told it is required (and kept here until it is done);
// anyone else is offered it and can go back.
async function Gate() {
  const actor = await requireSignedIn(TWO_FACTOR_SETUP_PATH)
  if (actor.twoFactorEnabled) redirect("/admin")
  const required = roleRequiresTwoFactor(actor.roles)
  return (
    <>
      <AuthHeader
        title={TITLE}
        description={
          required
            ? "Your role can change who has access, so two-factor authentication is required."
            : "Two-factor authentication is recommended: a code from your phone keeps your account safe even if your password leaks."
        }
      />
      <TwoFactorSetup />
      {required ? (
        <SignOutLink />
      ) : (
        <p className="text-sm text-muted-foreground">
          Not a good time?{" "}
          <Link
            href="/admin"
            className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Back to the dashboard
          </Link>
        </p>
      )}
    </>
  )
}
