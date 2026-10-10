"use client"

import { CopyIcon, DownloadIcon, ShieldCheckIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { LINK_FORM } from "@/admin/components/dashboard/page-header"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { useActor } from "@/admin/lib/actor-context"
import { authClient } from "@/admin/lib/auth-client"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  roleRecommendsTwoFactor,
  TWO_FACTOR_SETUP_PATH,
} from "@/lib/auth/two-factor-policy"

type Mode = "codes" | "disable" | null

export function TwoFactorCard() {
  const { twoFactorEnabled, roles } = useActor()
  // Optional for every role (change 2026-10-11); owners and admins are only
  // told why it matters more for them.
  const recommended = roleRecommendsTwoFactor(roles)
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [codes, setCodes] = useState<string[] | null>(null)

  const close = () => {
    setMode(null)
    setPassword("")
    setError(null)
    setCodes(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const result =
      mode === "codes"
        ? await authClient.twoFactor.generateBackupCodes({ password })
        : await authClient.twoFactor.disable({ password })
    setBusy(false)
    if (result.error) {
      setError(result.error.message ?? "That password didn't work")
      return
    }
    if (mode === "codes") {
      setCodes(
        (result.data as unknown as { backupCodes: string[] }).backupCodes
      )
      setPassword("")
      return
    }
    toast.success("Two-factor authentication is off")
    close()
    router.refresh()
  }

  const text = codes?.join("\n") ?? ""

  if (!twoFactorEnabled) {
    return (
      <div className="flex flex-col items-start gap-4">
        <StatusPill tone="warning">Off</StatusPill>
        <p className="text-sm text-muted-foreground">
          Turn on two-factor authentication: a code from an authenticator app is
          asked for when you sign in on a new device.
        </p>
        {recommended ? (
          <p className="text-sm text-muted-foreground">
            Strongly recommended for your role, which can change who has access.
          </p>
        ) : null}
        <Link
          href={TWO_FACTOR_SETUP_PATH}
          data-slot="button"
          className={LINK_FORM}
        >
          <ShieldCheckIcon data-icon="inline-start" />
          Set up two-factor
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <StatusPill tone="success">On</StatusPill>
      <p className="text-sm text-muted-foreground">
        A code from an authenticator app is asked for when you sign in on a new
        device.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setMode("codes")}>
          New backup codes
        </Button>
        <Button variant="ghost" onClick={() => setMode("disable")}>
          Turn off
        </Button>
      </div>
      <Dialog
        open={mode !== null}
        onOpenChange={(open) => (open ? null : close())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "codes" ? "New backup codes" : "Turn off two-factor"}
            </DialogTitle>
            <DialogDescription>
              {mode === "codes"
                ? "Your old backup codes stop working. Each new code works once."
                : recommended
                  ? "Signing in will only ask for your password. Your role can change who has access, so keeping it on is strongly recommended."
                  : "Signing in will only ask for your password."}
            </DialogDescription>
          </DialogHeader>
          {codes ? (
            <div className="flex flex-col gap-3">
              <ul className="grid grid-cols-2 gap-1 font-mono text-sm">
                {codes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(text)
                      .then(() => toast.success("Copied"))
                  }
                >
                  <CopyIcon data-icon="inline-start" /> Copy
                </Button>
                <a
                  className={buttonVariants({ variant: "outline" })}
                  href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
                  download="magda-kennedy-backup-codes.txt"
                >
                  <DownloadIcon data-icon="inline-start" /> Download
                </a>
                <Button onClick={close}>I&apos;ve saved them</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="two-factor-password">Password</FieldLabel>
                <Input
                  id="two-factor-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {error ? <FieldError>{error}</FieldError> : null}
              </Field>
              <DialogFooter>
                <Button type="submit" disabled={busy || !password}>
                  {mode === "codes" ? "Generate" : "Turn off two-factor"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
