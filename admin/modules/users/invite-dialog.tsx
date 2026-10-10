"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { useActor } from "@/admin/lib/actor-context"
import { parseResponse, usersApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button } from "@/components/ui/button"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { ROLE_LABELS, ROLE_PURPOSE } from "@/lib/auth/role-labels"
import { InviteInput } from "@/lib/users/schema"

export function InviteDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose(): void
}) {
  const actor = useActor()
  const client = useQueryClient()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<RoleName>("editor")
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Only an owner can hand out the owner role.
  const grantable = ROLE_NAMES.filter(
    (r) => r !== "owner" || actor.roles.includes("owner")
  )
  const items = grantable.map((r) => ({ value: r, label: ROLE_LABELS[r] }))

  const invite = useMutation({
    mutationFn: (json: InviteInput) =>
      parseResponse(usersApi.invite.$post({ json })),
    onSuccess: (_result, json) => {
      toast.success(`Invite sent to ${json.email}`)
      void client.invalidateQueries({ queryKey: queryKeys.users.all })
      close()
    },
    onError: (error) => {
      const fields = (error as { fieldErrors?: Record<string, string[]> })
        .fieldErrors
      setErrors({
        ...Object.fromEntries(
          Object.entries(fields ?? {}).map(([k, v]) => [k, v[0] ?? ""])
        ),
        form: error.message,
      })
    },
  })

  function close() {
    setName("")
    setEmail("")
    setRole("editor")
    setErrors({})
    invite.reset()
    onClose()
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = InviteInput.safeParse({ name, email, role })
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >
      setErrors(
        Object.fromEntries(
          Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ""])
        )
      )
      return
    }
    setErrors({})
    invite.mutate(parsed.data)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>
            They get an email with a link to choose their password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor="invite-name">Name</FieldLabel>
            <Input
              id="invite-name"
              value={name}
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              onChange={(event) => setName(event.target.value)}
            />
            {errors.name ? <FieldError>{errors.name}</FieldError> : null}
          </Field>
          <Field data-invalid={errors.email ? true : undefined}>
            <FieldLabel htmlFor="invite-email">Email</FieldLabel>
            <Input
              id="invite-email"
              type="email"
              value={email}
              autoComplete="off"
              aria-invalid={errors.email ? true : undefined}
              onChange={(event) => setEmail(event.target.value)}
            />
            {errors.email ? <FieldError>{errors.email}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="invite-role">Role</FieldLabel>
            <Select
              items={items}
              value={role}
              onValueChange={(value) => setRole(value as RoleName)}
            >
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {ROLE_PURPOSE[role]}
            </p>
          </Field>
          {errors.form ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.form}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
