import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthFormSkeleton, AuthHeader } from "@/admin/modules/auth/auth-header"
import { SignInForm } from "@/admin/modules/auth/sign-in-form"
import { safeNext } from "@/lib/auth/safe-next"
import { getSession } from "@/server/auth/session"

export const metadata: Metadata = { title: "Sign in" }

export default function SignInPage({
  searchParams,
}: PageProps<"/admin/sign-in">) {
  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        title="Welcome back"
        description="Sign in to manage the website."
      />
      {/* Request-time data (session, search params) streams in under Cache
          Components, so it sits behind Suspense. */}
      <Suspense fallback={<AuthFormSkeleton />}>
        <SignInGate searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

// The proxy only sees cookies, so the real "already signed in" check is here:
// a valid session skips the form. A stale cookie fails it and gets the form,
// which is why this cannot loop with the panel's guard.
async function SignInGate({
  searchParams,
}: Pick<PageProps<"/admin/sign-in">, "searchParams">) {
  const { next } = await searchParams
  const target = safeNext(typeof next === "string" ? next : null)
  if (await getSession()) redirect(target)
  return <SignInForm next={target} />
}
