"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/admin/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"

import { PasswordInput } from "./password-input"
import { authButtonClass } from "./styles"

// Matches emailAndPassword.minPasswordLength in server/auth/auth.ts.
const MIN_LENGTH = 12

export function ResetPasswordForm({
  token,
  invite,
}: {
  token: string
  invite: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password"))
    if (password.length < MIN_LENGTH) {
      return setError(`Use at least ${MIN_LENGTH} characters.`)
    }
    if (password !== String(form.get("confirm"))) {
      return setError("The two passwords don't match.")
    }
    setPending(true)
    setError(null)
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    })
    if (error) {
      setPending(false)
      return setError(
        "This link has expired or was already used. Ask for a new one."
      )
    }
    toast.success(
      invite
        ? "Password set. Sign in to get started."
        : "Password updated. Sign in with your new password."
    )
    router.replace("/admin/sign-in")
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">
            {invite ? "Choose a password" : "New password"}
          </FieldLabel>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
            aria-describedby="password-hint"
          />
          <FieldDescription id="password-hint">
            At least {MIN_LENGTH} characters. A short phrase is easiest to
            remember.
          </FieldDescription>
        </Field>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="confirm">Repeat password</FieldLabel>
          <PasswordInput
            id="confirm"
            name="confirm"
            autoComplete="new-password"
            required
            aria-invalid={error ? true : undefined}
          />
          {error && <FieldError errors={[{ message: error }]} />}
        </Field>
        <Button type="submit" disabled={pending} className={authButtonClass}>
          {pending ? "Saving…" : invite ? "Set password" : "Update password"}
        </Button>
      </FieldGroup>
    </form>
  )
}
