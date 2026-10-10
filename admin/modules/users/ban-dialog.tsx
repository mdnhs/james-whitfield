"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

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
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { UserDto } from "@/server/modules/users/manage"

const LENGTHS = [
  { value: "forever", label: "Until I lift it", days: null },
  { value: "1", label: "1 day", days: 1 },
  { value: "7", label: "7 days", days: 7 },
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
] as const

export function BanDialog({
  user,
  onClose,
}: {
  user: UserDto | null
  onClose(): void
}) {
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {user ? <BanForm key={user.id} user={user} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function BanForm({ user, onClose }: { user: UserDto; onClose(): void }) {
  const client = useQueryClient()
  const [length, setLength] = useState<string>("forever")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const ban = useMutation({
    mutationFn: () =>
      parseResponse(
        usersApi[":id"].ban.$post({
          param: { id: user.id },
          json: {
            days: LENGTHS.find((l) => l.value === length)?.days ?? null,
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          },
        })
      ),
    onSuccess: () => {
      toast.success(`${user.name} is banned`)
      void client.invalidateQueries({ queryKey: queryKeys.users.all })
      onClose()
    },
    onError: (e) => setError(e.message),
  })
  return (
    <>
      <DialogHeader>
        <DialogTitle>Ban {user.name}?</DialogTitle>
        <DialogDescription>
          They are signed out everywhere and can&apos;t sign in until the ban
          ends or you lift it.
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="ban-length">For how long</FieldLabel>
        <Select
          items={LENGTHS.map(({ value, label }) => ({ value, label }))}
          value={length}
          onValueChange={(value) => setLength(String(value))}
        >
          <SelectTrigger id="ban-length" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LENGTHS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="ban-reason">Reason (optional)</FieldLabel>
        <Input
          id="ban-reason"
          value={reason}
          maxLength={200}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
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
          variant="destructive"
          disabled={ban.isPending}
          onClick={() => {
            setError(null)
            ban.mutate()
          }}
        >
          Ban {user.name}
        </Button>
      </DialogFooter>
    </>
  )
}
