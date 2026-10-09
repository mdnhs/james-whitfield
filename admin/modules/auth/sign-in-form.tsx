"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { authClient } from "@/admin/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { authRequest } from "./auth-errors"
import { PasswordInput } from "./password-input"
import { authButtonClass, authInputClass } from "./styles"

// `next` is already sanitised by the page (safeNext).
export function SignInForm({ next }: { next: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    const { data, failure } = await authRequest(() =>
      authClient.signIn.email({
        email: String(form.get("email")),
        password: String(form.get("password")),
      })
    )
    if (failure) {
      setPending(false)
      // Generic on purpose: never reveal which accounts exist.
      return setError(
        failure.message ?? "That email and password don't match an account."
      )
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      return router.push(`/admin/two-factor?next=${encodeURIComponent(next)}`)
    }
    // Stays pending: the panel replaces this screen.
    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            className={authInputClass}
          />
        </Field>
        <Field data-invalid={error ? true : undefined}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              href="/admin/forgot-password"
              className="rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={error ? true : undefined}
          />
          {error && <FieldError errors={[{ message: error }]} />}
        </Field>
        <Button type="submit" disabled={pending} className={authButtonClass}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </FieldGroup>
    </form>
  )
}
