"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { SchemaForm } from "@/admin/components/schema-form/schema-form"
import { authClient } from "@/admin/lib/auth-client"
import { queryKeys } from "@/admin/lib/query-keys"
import { useResetOnHide } from "@/admin/lib/use-reset-on-hide"
import { authRequest } from "@/admin/modules/auth/auth-errors"

import { PasswordSchema } from "./schemas"

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" }

export function PasswordForm() {
  const queryClient = useQueryClient()
  // Cache Components keeps this route mounted but hidden once the user moves
  // on; remounting the form drops typed passwords from the hidden DOM.
  const [generation, setGeneration] = useState(0)
  const begin = useResetOnHide(() => setGeneration((n) => n + 1))

  return (
    <SchemaForm
      key={generation}
      schema={PasswordSchema}
      defaultValues={EMPTY}
      submitLabel="Change password"
      resetOnSuccess
      onSubmit={async ({ currentPassword, newPassword }) => {
        const current = begin()
        // The server forces revokeOtherSessions too; sent so the intent is
        // visible here.
        const { failure } = await authRequest(() =>
          authClient.changePassword({
            currentPassword,
            newPassword,
            revokeOtherSessions: true,
          })
        )
        if (!current()) return
        if (
          failure?.kind === "rejected" &&
          failure.code === "INVALID_PASSWORD"
        ) {
          return {
            fieldErrors: { currentPassword: ["That password isn't right."] },
          }
        }
        if (failure) {
          return {
            formError:
              failure.message ?? "Couldn't change your password. Try again.",
          }
        }
        toast.success("Password changed. Your other devices are signed out.")
        void queryClient.invalidateQueries({
          queryKey: queryKeys.account.sessions,
        })
      }}
    />
  )
}
