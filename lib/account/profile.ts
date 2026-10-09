import * as z from "zod"

// The display-name rule, shared by the Account form and the server hook on
// Better Auth's /update-user (server/auth/account-hooks.ts), so a crafted
// request meets the same limits as the form.
export const profileName = z
  .string()
  .trim()
  .min(1, "Enter your name")
  .max(80, "Use 80 characters or fewer")

// Name only: an email change would need verification first, and `image` is
// not part of the profile. Unknown keys are refused, not dropped.
export const ProfileUpdate = z.strictObject({ name: profileName })
