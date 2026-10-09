import { TriangleAlertIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { AuthFormSkeleton, AuthHeader } from "@/admin/modules/auth/auth-header"
import { BackToSignIn } from "@/admin/modules/auth/back-to-sign-in"
import { ResetPasswordForm } from "@/admin/modules/auth/reset-password-form"

export const metadata: Metadata = { title: "Set password" }

// Reached from the email link: Better Auth checks the token, then redirects
// here with ?token=… (or ?error=INVALID_TOKEN). Invites add ?invite=1.
export default function ResetPasswordPage({
  searchParams,
}: PageProps<"/admin/reset-password">) {
  return (
    <div className="flex flex-col gap-8">
      <Suspense
        fallback={
          <>
            <AuthHeader title="Set your password" />
            <AuthFormSkeleton />
          </>
        }
      >
        <ResetPasswordContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ResetPasswordContent({
  searchParams,
}: Pick<PageProps<"/admin/reset-password">, "searchParams">) {
  const params = await searchParams
  const token = typeof params.token === "string" ? params.token : null
  const invite = params.invite === "1"

  if (!token || params.error) {
    return (
      <>
        <AuthHeader title="This link no longer works" />
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl bg-muted p-5 text-sm leading-relaxed"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p>
            It may have expired, been used already, or been copied incompletely.{" "}
            <Link
              href="/admin/forgot-password"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Ask for a new link
            </Link>
            .
          </p>
        </div>
        <BackToSignIn />
      </>
    )
  }

  return (
    <>
      <AuthHeader
        title={invite ? "Welcome aboard" : "Set a new password"}
        description={
          invite
            ? "You've been invited to manage the website. Choose a password to finish setting up your account."
            : "Choose a new password for your account."
        }
      />
      <ResetPasswordForm token={token} invite={invite} />
    </>
  )
}
