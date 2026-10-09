"use client"

import { MailCheckIcon } from "lucide-react"
import { useState } from "react"

import { authClient } from "@/admin/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { authButtonClass, authInputClass } from "./styles"

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    await authClient.requestPasswordReset({
      email: String(new FormData(event.currentTarget).get("email")),
      redirectTo: "/admin/reset-password",
    })
    setPending(false)
    // Same message whether or not the account exists.
    setSent(true)
  }

  if (sent) {
    return (
      <div
        role="status"
        className="flex items-start gap-4 rounded-2xl bg-accent p-5 text-accent-foreground"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-primary">
          <MailCheckIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">Check your inbox</p>
          <p className="text-sm leading-relaxed">
            If that email has an account, a reset link is on its way. It works
            for 24 hours.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit}>
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
        <Button type="submit" disabled={pending} className={authButtonClass}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </FieldGroup>
    </form>
  )
}
