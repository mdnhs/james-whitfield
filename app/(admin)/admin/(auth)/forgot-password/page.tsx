import type { Metadata } from "next"

import { AuthHeader } from "@/admin/modules/auth/auth-header"
import { BackToSignIn } from "@/admin/modules/auth/back-to-sign-in"
import { ForgotPasswordForm } from "@/admin/modules/auth/forgot-password-form"

export const metadata: Metadata = { title: "Forgot password" }

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <AuthHeader
        title="Forgot your password?"
        description="Enter your email and we'll send you a link to choose a new one."
      />
      <ForgotPasswordForm />
      <BackToSignIn />
    </div>
  )
}
