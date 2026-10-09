import "server-only"

import { sendEmail } from "@/server/lib/email"
import { inviteEmail, passwordResetEmail } from "@/server/lib/email/templates"

// Invites reuse the reset flow (docs/brief.md §7.4). Better Auth builds
// `<base>/reset-password/<token>?callbackURL=<encoded redirect>`; an invite's
// redirect carries `invite=1`, so the email can be worded as an invitation.
export function isInviteLink(url: string): boolean {
  try {
    const callback = new URL(url).searchParams.get("callbackURL")
    if (!callback) return false
    const target = new URL(callback, "http://placeholder.invalid")
    return target.searchParams.get("invite") === "1"
  } catch {
    return false
  }
}

type Recipient = { name: string; email: string }
type Send = typeof sendEmail

// Never throws and is never awaited by the caller: a failure must not change
// the response, or it would reveal which emails have accounts (a template
// error would otherwise be a 500 only for existing users).
export function deliverResetEmail(
  user: Recipient,
  url: string,
  send: Send = sendEmail
): void {
  void Promise.resolve()
    .then(() => {
      const message = isInviteLink(url)
        ? inviteEmail({ name: user.name, url })
        : passwordResetEmail({ name: user.name, url })
      return send({ to: user.email, ...message })
    })
    .catch((error) => console.error("[auth] could not send email", error))
}
