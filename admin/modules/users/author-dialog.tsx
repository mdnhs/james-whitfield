"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { parseResponse, usersApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { authorsQuery } from "@/admin/modules/insights/queries"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { UserDto } from "@/server/modules/users/manage"

const NONE = "__none__"

export function AuthorDialog({
  user,
  onClose,
}: {
  user: UserDto | null
  onClose(): void
}) {
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {user ? (
          <AuthorForm key={user.id} user={user} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function AuthorForm({ user, onClose }: { user: UserDto; onClose(): void }) {
  const client = useQueryClient()
  const authors = useQuery(authorsQuery())
  const [chosen, setChosen] = useState(user.author?.id ?? NONE)
  const [error, setError] = useState<string | null>(null)
  const items = [
    { value: NONE, label: "No author profile" },
    ...(authors.data?.items ?? []).map((a) => ({
      value: a.id,
      label: a.name,
    })),
  ]
  const save = useMutation({
    mutationFn: () =>
      parseResponse(
        usersApi[":id"].author.$put({
          param: { id: user.id },
          json: { authorId: chosen === NONE ? null : chosen },
        })
      ),
    onSuccess: () => {
      toast.success(`Author profile updated for ${user.name}`)
      void client.invalidateQueries({ queryKey: queryKeys.users.all })
      onClose()
    },
    onError: (e) => setError(e.message),
  })
  return (
    <>
      <DialogHeader>
        <DialogTitle>Author profile for {user.name}</DialogTitle>
        <DialogDescription>
          Articles by this author show on their public profile, and this person
          can edit them.
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="author-link">Author profile</FieldLabel>
        <Select
          items={items}
          value={chosen}
          onValueChange={(value) => setChosen(String(value))}
        >
          <SelectTrigger id="author-link" className="w-full">
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
          disabled={save.isPending}
          onClick={() => {
            setError(null)
            save.mutate()
          }}
        >
          Save
        </Button>
      </DialogFooter>
    </>
  )
}
