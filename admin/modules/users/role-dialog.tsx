"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { useActor } from "@/admin/lib/actor-context"
import { parseResponse, usersApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { ROLE_LABELS, ROLE_PURPOSE } from "@/lib/auth/role-labels"
import type { UserDto } from "@/server/modules/users/manage"

export function RoleDialog({
  user,
  onClose,
}: {
  user: UserDto | null
  onClose(): void
}) {
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {user ? <RoleForm key={user.id} user={user} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function RoleForm({ user, onClose }: { user: UserDto; onClose(): void }) {
  const actor = useActor()
  const client = useQueryClient()
  const [chosen, setChosen] = useState<RoleName[]>(user.roles)
  const [error, setError] = useState<string | null>(null)
  const isOwner = actor.roles.includes("owner")

  const save = useMutation({
    mutationFn: (roles: RoleName[]) =>
      parseResponse(
        usersApi[":id"].role.$patch({ param: { id: user.id }, json: { roles } })
      ),
    onSuccess: () => {
      toast.success(`Roles updated for ${user.name}`)
      void client.invalidateQueries({ queryKey: queryKeys.users.all })
      onClose()
    },
    onError: (e) => setError(e.message),
  })

  const toggle = (role: RoleName, on: boolean) =>
    setChosen((current) =>
      on ? [...current, role] : current.filter((r) => r !== role)
    )

  return (
    <>
      <DialogHeader>
        <DialogTitle>Roles for {user.name}</DialogTitle>
        <DialogDescription>
          Choose one or more. They get everything any chosen role allows.
        </DialogDescription>
      </DialogHeader>
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Roles</legend>
        {ROLE_NAMES.map((role) => {
          const locked = role === "owner" && !isOwner
          return (
            <div key={role} className="flex items-start gap-3">
              <Checkbox
                id={`role-${role}`}
                checked={chosen.includes(role)}
                disabled={locked}
                onCheckedChange={(on) => toggle(role, on === true)}
                className="mt-1"
              />
              <Label
                htmlFor={`role-${role}`}
                className="flex flex-col items-start gap-0.5"
              >
                <span className="font-semibold">{ROLE_LABELS[role]}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {ROLE_PURPOSE[role]}
                  {locked ? " Only an owner can grant this." : ""}
                </span>
              </Label>
            </div>
          )
        })}
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={save.isPending || chosen.length === 0}
          onClick={() => {
            setError(null)
            save.mutate(chosen)
          }}
        >
          Save roles
        </Button>
      </DialogFooter>
    </>
  )
}
