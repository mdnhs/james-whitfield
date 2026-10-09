import * as z from "zod"

import { ui } from "@/admin/components/schema-form/registry"
import { profileName } from "@/lib/account/profile"

// Name only (lib/account/profile.ts); the server enforces the same rule.
// A clone carries the UI hints, so the shared rule stays metadata-free.
export const ProfileSchema = z.object({
  name: profileName
    .clone()
    .register(ui, { label: "Full name", autoComplete: "name" }),
})

// Better Auth enforces 12 characters too (docs/brief.md §7.1). There is no
// "keep my other devices signed in" choice: the server always signs them out
// (server/auth/account-hooks.ts), so a leaked password stops working
// everywhere at once.
export const PasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Enter your current password")
      .register(ui, {
        label: "Current password",
        inputType: "password",
        autoComplete: "current-password",
      }),
    newPassword: z
      .string()
      .min(12, "Use at least 12 characters")
      .max(128, "Use 128 characters or fewer")
      .register(ui, {
        label: "New password",
        inputType: "password",
        autoComplete: "new-password",
        description: "At least 12 characters. A short sentence works well.",
      }),
    confirmPassword: z.string().register(ui, {
      label: "Confirm new password",
      inputType: "password",
      autoComplete: "new-password",
    }),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords don't match",
  })
