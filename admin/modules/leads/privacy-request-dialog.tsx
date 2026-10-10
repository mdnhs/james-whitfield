"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { toast } from "sonner"

import { leadsApi, parseResponse } from "@/admin/lib/api"
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

const normal = (value: string) => value.trim().toLowerCase()

// A person's right of access and erasure (GDPR): everything held under one
// email address, across enquiries and newsletter subscriptions.
export function PrivacyRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange(open: boolean): void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <Body onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

// Mounted only while open, so the fields start empty each time.
function Body({ onDone }: { onDone(): void }) {
  const client = useQueryClient()
  const emailId = useId()
  const confirmId = useId()
  const [email, setEmail] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [again, setAgain] = useState("")
  const address = normal(email)

  const download = useMutation({
    mutationFn: async () => {
      const data = await parseResponse(
        leadsApi.dsar.$get({ query: { email: address } })
      )
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      )
      const link = document.createElement("a")
      link.href = url
      link.download = `privacy-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    },
    onError: (error) => toast.error(error.message),
  })

  const erase = useMutation({
    mutationFn: () =>
      parseResponse(leadsApi.dsar.$delete({ query: { email: address } })),
    onSuccess: (result) => {
      toast.success(
        `Erased ${result.leads} enquiries and ${result.newsletter} subscriptions`
      )
      void client.invalidateQueries({ queryKey: queryKeys.leads.all })
      onDone()
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Privacy request</DialogTitle>
        <DialogDescription>
          Download or erase everything held for one email address.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor={emailId}>Email address</FieldLabel>
          <Input
            id={emailId}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setConfirming(false)
              setAgain("")
            }}
          />
        </Field>
        {confirming ? (
          <Field>
            <FieldLabel htmlFor={confirmId}>
              Type the email to confirm
            </FieldLabel>
            <Input
              id={confirmId}
              type="email"
              autoComplete="off"
              value={again}
              onChange={(event) => setAgain(event.target.value)}
            />
          </Field>
        ) : null}
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          disabled={!address || download.isPending}
          onClick={() => download.mutate()}
        >
          Download data
        </Button>
        {confirming ? (
          <Button
            variant="destructive"
            disabled={normal(again) !== address || erase.isPending}
            onClick={() => erase.mutate()}
          >
            Erase permanently
          </Button>
        ) : (
          <Button
            variant="destructive"
            disabled={!address}
            onClick={() => setConfirming(true)}
          >
            Erase all data
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
