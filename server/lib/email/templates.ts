import "server-only"

// Plain transactional templates. Phase 6 replaces them with React Email.
const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char)

const layout = (title: string, body: string) =>
  `<!doctype html><html><body style="margin:0;background:#f2f3f2;padding:24px;font-family:Arial,sans-serif;color:#111411">` +
  `<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">` +
  `<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>${body}</div></body></html>`

const button = (url: string, label: string) =>
  `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#16823a;color:#ffffff;padding:12px 20px;border-radius:12px;text-decoration:none">${escapeHtml(label)}</a></p>`

type LinkEmail = { name: string; url: string }

export function inviteEmail({ name, url }: LinkEmail) {
  return {
    subject: "You're invited to the Magda Kennedy admin",
    html: layout(
      "You're invited",
      `<p>Hi ${escapeHtml(name)},</p><p>You now have access to the website admin. Choose a password to get started. The link works for 24 hours.</p>${button(url, "Set your password")}`
    ),
    text: `Hi ${name},\n\nYou now have access to the website admin. Choose a password (the link works for 24 hours):\n${url}\n`,
  }
}

export function passwordResetEmail({ name, url }: LinkEmail) {
  return {
    subject: "Reset your admin password",
    html: layout(
      "Reset your password",
      `<p>Hi ${escapeHtml(name)},</p><p>Someone asked to reset your password. If it was you, use the button below; the link works for 24 hours. If it wasn't, you can ignore this email.</p>${button(url, "Reset password")}`
    ),
    text: `Hi ${name},\n\nReset your password (the link works for 24 hours):\n${url}\n\nIf you didn't ask for this, ignore this email.\n`,
  }
}
