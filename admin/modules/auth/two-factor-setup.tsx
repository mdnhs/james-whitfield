"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import QRCode from "qrcode"
import { useId, useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/admin/lib/auth-client"
import { useResetOnHide } from "@/admin/lib/use-reset-on-hide"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { authRequest } from "./auth-errors"
import { PasswordInput } from "./password-input"
import { authButtonClass, authInputClass } from "./styles"

type Step = "password" | "scan" | "codes"

const STEPS: Step[] = ["password", "scan", "codes"]

export function TwoFactorSetup() {
  // Hidden auth routes stay in the DOM (Activity), so ids must be unique.
  const uid = useId()
  const router = useRouter()
  const [step, setStep] = useState<Step>("password")
  const [secret, setSecret] = useState("")
  const [qr, setQr] = useState("")
  const [codes, setCodes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  // Also drops the secret and backup codes rather than keep them in a
  // hidden DOM once the user moves on.
  const begin = useResetOnHide(() => {
    setStep("password")
    setSecret("")
    setQr("")
    setCodes([])
    setError(null)
    setPending(false)
    setCopied(false)
  })

  async function enable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = String(new FormData(event.currentTarget).get("password"))
    const current = begin()
    setPending(true)
    setError(null)
    const { data, failure } = await authRequest(() =>
      authClient.twoFactor.enable({ password })
    )
    if (!current()) return
    if (failure || data?.method !== "totp") {
      setPending(false)
      return setError(failure?.message ?? "That password is not correct.")
    }
    const qrCode = await QRCode.toDataURL(data.totpURI, {
      margin: 1,
      width: 192,
    })
    if (!current()) return
    setSecret(new URL(data.totpURI).searchParams.get("secret") ?? "")
    setQr(qrCode)
    setCodes(data.backupCodes)
    setPending(false)
    setStep("scan")
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = String(new FormData(event.currentTarget).get("code")).trim()
    const current = begin()
    setPending(true)
    setError(null)
    const { failure } = await authRequest(() =>
      authClient.twoFactor.verifyTotp({ code })
    )
    if (!current()) return
    setPending(false)
    if (failure) {
      return setError(
        failure.message ??
          "That code didn't work. Check your phone's clock and try again."
      )
    }
    // Enrolled: the secret has done its job. Only the backup codes remain
    // on screen, and only until the user moves on.
    setSecret("")
    setQr("")
    setStep("codes")
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"))
      setCopied(true)
    } catch {
      toast.error("Couldn't copy. Select the codes and copy them instead.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ol aria-label="Setup progress" className="flex gap-2">
        {STEPS.map((item, index) => (
          <li
            key={item}
            aria-current={item === step ? "step" : undefined}
            className={cn(
              "h-1.5 flex-1 rounded-full bg-muted transition-colors",
              index <= STEPS.indexOf(step) && "bg-primary"
            )}
          >
            <span className="sr-only">
              Step {index + 1} of {STEPS.length}
            </span>
          </li>
        ))}
      </ol>

      {step === "password" && (
        <form onSubmit={enable} noValidate>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor={`${uid}-password`}>
                Current password
              </FieldLabel>
              <PasswordInput
                id={`${uid}-password`}
                name="password"
                autoComplete="current-password"
                required
                aria-invalid={error ? true : undefined}
              />
              <FieldDescription>
                Confirm it&apos;s you before changing how you sign in.
              </FieldDescription>
              {error && <FieldError errors={[{ message: error }]} />}
            </Field>
            <Button
              type="submit"
              disabled={pending}
              className={authButtonClass}
            >
              {pending ? "Checking…" : "Continue"}
            </Button>
          </FieldGroup>
        </form>
      )}

      {step === "scan" && (
        <form onSubmit={verify} noValidate className="flex flex-col gap-6">
          <div className="flex items-center gap-5 rounded-2xl bg-muted p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
            <img
              src={qr}
              alt="QR code for your authenticator app"
              width={128}
              height={128}
              className="size-32 shrink-0 rounded-xl bg-white p-1.5"
            />
            <div className="flex min-w-0 flex-col gap-2 text-sm leading-relaxed">
              <p>Scan this with an authenticator app on your phone.</p>
              <p className="text-muted-foreground">
                Can&apos;t scan? Enter this key instead:
              </p>
              <code
                data-testid="totp-secret"
                className="font-mono text-xs break-all text-foreground"
              >
                {secret}
              </code>
            </div>
          </div>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor={`${uid}-code`}>6-digit code</FieldLabel>
              <Input
                id={`${uid}-code`}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                aria-invalid={error ? true : undefined}
                className={cn(authInputClass, "font-mono tracking-[0.3em]")}
              />
              <FieldDescription>From your authenticator app.</FieldDescription>
              {error && <FieldError errors={[{ message: error }]} />}
            </Field>
            <Button
              type="submit"
              disabled={pending}
              className={authButtonClass}
            >
              {pending ? "Verifying…" : "Verify"}
            </Button>
          </FieldGroup>
        </form>
      )}

      {step === "codes" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">Save your backup codes</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Each code works once if you lose your phone. Store them somewhere
              safe, like a password manager. They won&apos;t be shown again.
            </p>
          </div>
          <ul
            aria-label="Backup codes"
            className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-muted p-5 font-mono text-sm"
          >
            {codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={copyCodes}
              className={cn(authButtonClass, "border-primary text-primary")}
            >
              {copied ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <CopyIcon data-icon="inline-start" />
              )}
              {copied ? "Copied" : "Copy codes"}
            </Button>
            <Button
              type="button"
              className={authButtonClass}
              onClick={() => {
                router.replace("/admin")
                router.refresh()
              }}
            >
              I&apos;ve saved them
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
