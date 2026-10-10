"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { usePermission } from "@/admin/lib/actor-context"
import { pagesApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

import type { PageDetail } from "./queries"

// Ruling R6: only custom pages move; a published one leaves a 301 behind.
export function AddressForm({
  page,
  onChanged,
}: {
  page: Pick<PageDetail, "id" | "path" | "systemKey">
  onChanged(path: string): void
}) {
  const canUpdate = usePermission({ page: ["update"] })
  const queryClient = useQueryClient()
  const [value, setValue] = useState(page.path)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const change = useMutation({
    mutationFn: () =>
      parseResponse(
        pagesApi[":id"].path.$patch({
          param: { id: page.id },
          json: { path: value },
        })
      ),
    onSuccess: (result) => {
      setError(null)
      setValue(result.path)
      setWarnings(result.warnings)
      toast.success(
        result.redirected
          ? "Address changed. The old address now redirects here."
          : "Address changed."
      )
      onChanged(result.path)
      void queryClient.invalidateQueries({ queryKey: queryKeys.pages.all })
    },
    onError: (e) => {
      if (!(e instanceof ApiError)) throw e
      setError(e.fieldErrors.path?.[0] ?? e.message)
    },
  })

  const system = page.systemKey !== null
  return (
    <section
      aria-labelledby="address-heading"
      className="rounded-card flex flex-col gap-4 bg-card p-5 sm:p-6"
    >
      <h2 id="address-heading" className="text-card-title">
        Page address
      </h2>
      {system ? (
        <>
          <p className="font-mono text-sm">{page.path}</p>
          <p className="text-sm text-muted-foreground">
            System pages keep their address.
          </p>
        </>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            change.mutate()
          }}
        >
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="page-address">Address</FieldLabel>
            <Input
              id="page-address"
              value={value}
              disabled={!canUpdate}
              aria-invalid={error ? true : undefined}
              onChange={(event) => setValue(event.target.value)}
            />
            <FieldDescription>
              One lower-case segment, e.g. /team. A published page keeps a
              redirect from its old address.
            </FieldDescription>
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
          {warnings.length ? (
            <ul className="text-warning flex flex-col gap-1 text-sm">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          <div>
            <Button
              type="submit"
              disabled={!canUpdate || change.isPending || value === page.path}
            >
              {change.isPending ? <Spinner data-icon="inline-start" /> : null}
              Change address
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
