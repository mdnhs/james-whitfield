import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthFormSkeleton, AuthHeader } from "@/admin/modules/auth/auth-header"
import { BackToSignIn } from "@/admin/modules/auth/back-to-sign-in"
import { TwoFactorForm } from "@/admin/modules/auth/two-factor-form"
import { safeNext } from "@/lib/auth/safe-next"
import { getSession } from "@/server/auth/session"

export const metadata: Metadata = { title: "Two-factor" }

// Second sign-in step. Public in proxy.ts: there is no session yet, only
// Better Auth's short-lived two-factor challenge cookie.
export default function TwoFactorPage({
  searchParams,
}: PageProps<"/admin/two-factor">) {
  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        title="Check your authenticator"
        description="Enter the code from your app to finish signing in."
      />
      <Suspense fallback={<AuthFormSkeleton />}>
        <Gate searchParams={searchParams} />
      </Suspense>
      <BackToSignIn />
    </div>
  )
}

// `next` is sanitised here, before the form or this page can redirect to it.
async function Gate({
  searchParams,
}: Pick<PageProps<"/admin/two-factor">, "searchParams">) {
  const { next } = await searchParams
  const target = safeNext(typeof next === "string" ? next : null)
  if (await getSession()) redirect(target)
  return <TwoFactorForm next={target} />
}
