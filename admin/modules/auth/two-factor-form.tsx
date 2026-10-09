"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"

import { authClient } from "@/admin/lib/auth-client"
import { getQueryClient } from "@/admin/lib/query-client"
import { useResetOnHide } from "@/admin/lib/use-reset-on-hide"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { authRequest } from "./auth-errors"
import { authButtonClass, authInputClass } from "./styles"

// The sign-in challenge is gone (expired after 10 minutes, or too many
// wrong codes): only a fresh password sign-in can start a new one.
const CHALLENGE_OVER = new Set([
  "INVALID_TWO_FACTOR_COOKIE",
  "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE",
])

// `next` is already sanitised by the page (safeNext).
export function TwoFactorForm({ next }: { next: string }) {
  // Hidden auth routes stay in the DOM (Activity), so ids must be unique.
  const uid = useId()
  const router = useRouter()
  const [backup, setBackup] = useState(false)
  const [trust, setTrust] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [pending, setPending] = useState(false)

  const begin = useResetOnHide(() => {
    setPending(false)
    setError(null)
    setExpired(false)
    setBackup(false)
  })

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = String(new FormData(event.currentTarget).get("code")).trim()
    const current = begin()
    setPending(true)
    setError(null)
    const { failure } = await authRequest(() =>
      backup
        ? authClient.twoFactor.verifyBackupCode({ code, trustDevice: trust })
        : authClient.twoFactor.verifyTotp({ code, trustDevice: trust })
    )
    // Hidden meanwhile (the user went elsewhere): leave that screen be.
    if (!current()) return
    if (failure) {
      setPending(false)
      if (
        failure.kind === "rejected" &&
        CHALLENGE_OVER.has(failure.code ?? "")
      ) {
        return setExpired(true)
      }
      return setError(failure.message ?? "That code didn't work. Try again.")
    }
    // A new session starts with an empty cache (sign-out already clears it;
    // this covers a session that ended any other way).
    getQueryClient().clear()
    // Stays pending: the panel replaces this screen.
    router.replace(next)
    router.refresh()
  }

  if (expired) {
    return (
      <div role="alert" className="flex flex-col gap-4">
        <p className="rounded-2xl bg-muted p-5 text-sm leading-relaxed">
          This sign-in has timed out. Enter your password again to continue.
        </p>
        <Link
          href={`/admin/sign-in?next=${encodeURIComponent(next)}`}
          className={cn(
            authButtonClass,
            "inline-flex items-center justify-center bg-primary text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
          )}
        >
          Sign in again
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-code`}>
            {backup ? "Backup code" : "6-digit code"}
          </FieldLabel>
          <Input
            // A fresh input per mode: the two codes have different shapes.
            key={backup ? "backup" : "totp"}
            id={`${uid}-code`}
            name="code"
            inputMode={backup ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoCapitalize="off"
            spellCheck={false}
            required
            autoFocus
            aria-invalid={error ? true : undefined}
            className={cn(authInputClass, "font-mono tracking-[0.2em]")}
          />
          {error && <FieldError errors={[{ message: error }]} />}
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            id={`${uid}-trust`}
            checked={trust}
            onCheckedChange={(checked) => setTrust(checked)}
          />
          <FieldLabel htmlFor={`${uid}-trust`} className="font-normal">
            Trust this device for 30 days
          </FieldLabel>
        </Field>
        <Button type="submit" disabled={pending} className={authButtonClass}>
          {pending ? "Verifying…" : "Verify"}
        </Button>
        <Button
          type="button"
          variant="link"
          className="h-auto self-center p-0"
          onClick={() => {
            setBackup((value) => !value)
            setError(null)
          }}
        >
          {backup ? "Use your authenticator app" : "Use a backup code"}
        </Button>
      </FieldGroup>
    </form>
  )
}
