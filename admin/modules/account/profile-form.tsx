"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { SchemaForm } from "@/admin/components/schema-form/schema-form"
import { useActor } from "@/admin/lib/actor-context"
import { authClient } from "@/admin/lib/auth-client"
import { authRequest } from "@/admin/modules/auth/auth-errors"

import { ProfileSchema } from "./schemas"

export function ProfileForm() {
  const { user } = useActor()
  const router = useRouter()
  return (
    <SchemaForm
      schema={ProfileSchema}
      defaultValues={{ name: user.name }}
      submitLabel="Save profile"
      onSubmit={async ({ name }) => {
        const { failure } = await authRequest(() =>
          authClient.updateUser({ name })
        )
        // The server checks the name with the same rule (lib/account/profile).
        if (
          failure?.kind === "rejected" &&
          failure.code === "INVALID_PROFILE"
        ) {
          return {
            fieldErrors: {
              name: failure.fieldErrors?.name ?? [
                "Check your name and try again.",
              ],
            },
          }
        }
        if (failure) {
          return {
            formError:
              failure.message ?? "Couldn't save your profile. Try again.",
          }
        }
        toast.success("Profile saved")
        // The shell's name and avatar come from the server layout.
        router.refresh()
      }}
    />
  )
}
