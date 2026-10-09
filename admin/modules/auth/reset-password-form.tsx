"use client"

import { useRouter } from "next/navigation"
import { useId, useState } from "react"
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

import { authRequest } from "./auth-errors"
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
  // Hidden auth routes stay in the DOM (Activity), so ids must be unique.
  const uid = useId()
  // Each message sits under, and marks, the field it is about.
  const [error, setError] = useState<{
    field: "password" | "confirm"
    message: string
  } | null>(null)
  const [pending, setPending] = useState(false)

  const passwordError = error?.field === "password" ? error.message : null
  const confirmError = error?.field === "confirm" ? error.message : null

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password"))
    if (password.length < MIN_LENGTH) {
      return setError({
        field: "password",
        message: `Use at least ${MIN_LENGTH} characters.`,
      })
    }
    if (password !== String(form.get("confirm"))) {
      return setError({
        field: "confirm",
        message: "The two passwords don't match.",
      })
    }
    setPending(true)
    setError(null)
    const { failure } = await authRequest(() =>
      authClient.resetPassword({ newPassword: password, token })
    )
    if (failure) {
      setPending(false)
      return setError({
        field: "confirm",
        message:
          failure.message ??
          "This link has expired or was already used. Ask for a new one.",
      })
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
        <Field data-invalid={passwordError ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-password`}>
            {invite ? "Choose a password" : "New password"}
          </FieldLabel>
          <PasswordInput
            id={`${uid}-password`}
            name="password"
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
            aria-describedby={`${uid}-password-hint`}
            aria-invalid={passwordError ? true : undefined}
          />
          <FieldDescription id={`${uid}-password-hint`}>
            At least {MIN_LENGTH} characters. A short phrase is easiest to
            remember.
          </FieldDescription>
          {passwordError && (
            <FieldError errors={[{ message: passwordError }]} />
          )}
        </Field>
        <Field data-invalid={confirmError ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-confirm`}>Repeat password</FieldLabel>
          <PasswordInput
            id={`${uid}-confirm`}
            name="confirm"
            autoComplete="new-password"
            required
            aria-invalid={confirmError ? true : undefined}
          />
          {confirmError && <FieldError errors={[{ message: confirmError }]} />}
        </Field>
        <Button type="submit" disabled={pending} className={authButtonClass}>
          {pending ? "Saving…" : invite ? "Set password" : "Update password"}
        </Button>
      </FieldGroup>
    </form>
  )
}
