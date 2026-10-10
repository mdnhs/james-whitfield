"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { FORM_ACTION } from "@/admin/components/dashboard/page-header"
import { articlesApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { conflictOf, type Conflict } from "@/admin/modules/pages/use-autosave"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"

import { articlesListQuery } from "./queries"
import { dublinLocalToIso, isoToDublinLocal } from "./schedule-time"

type Exclusive = <R>(request: (version: number) => Promise<R>) => Promise<R>

type DialogProps<R> = {
  open: boolean
  onOpenChange(open: boolean): void
  id: string
  // The autosave queue's exclusive(): edits save first, then this runs.
  exclusive: Exclusive
  onDone(result: R): void
  onConflict(conflict: Conflict): void
}

export function ScheduleDialog(
  props: DialogProps<{ version: number; scheduledFor: string | null }>
) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule publishing</DialogTitle>
          <DialogDescription>
            The article goes live by itself at this time. Pick Dublin time.
          </DialogDescription>
        </DialogHeader>
        <ScheduleForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

// Mounted only while the dialog is open, so the default time is fresh.
function ScheduleForm({
  id,
  exclusive,
  onOpenChange,
  onDone,
  onConflict,
}: DialogProps<{ version: number; scheduledFor: string | null }>) {
  const [value, setValue] = useState(() =>
    isoToDublinLocal(new Date(Date.now() + 3_600_000).toISOString())
  )
  const [error, setError] = useState<string | null>(null)
  const schedule = useMutation({
    mutationFn: () => {
      const at = dublinLocalToIso(value)
      return exclusive((version) =>
        parseResponse(
          articlesApi[":id"].schedule.$post({
            param: { id },
            json: { version, at },
          })
        )
      )
    },
    onSuccess: (result) => {
      onOpenChange(false)
      toast.success("Scheduled")
      onDone(result)
    },
    onError: (failure) => {
      const conflict = conflictOf(failure)
      if (conflict) {
        onOpenChange(false)
        return onConflict(conflict)
      }
      setError(
        failure instanceof ApiError
          ? (failure.fieldErrors?.at?.[0] ?? failure.message)
          : failure.message
      )
    },
  })
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        schedule.mutate()
      }}
    >
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="schedule-at">Publish at (Dublin time)</FieldLabel>
        <Input
          id="schedule-at"
          type="datetime-local"
          value={value}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
      <div>
        <Button
          type="submit"
          className={FORM_ACTION}
          disabled={schedule.isPending}
        >
          {schedule.isPending ? <Spinner data-icon="inline-start" /> : null}
          Schedule
        </Button>
      </div>
    </form>
  )
}

type OldAddress = "none" | "insights" | "article"

export function UnpublishDialog(
  props: DialogProps<{ version: number; status: "draft" | "archived" }>
) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unpublish article</DialogTitle>
          <DialogDescription>
            It leaves the site and goes back to a draft you can keep editing.
          </DialogDescription>
        </DialogHeader>
        <UnpublishForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function UnpublishForm({
  id,
  exclusive,
  onOpenChange,
  onDone,
  onConflict,
}: DialogProps<{ version: number; status: "draft" | "archived" }>) {
  const [archive, setArchive] = useState(false)
  const [old, setOld] = useState<OldAddress>("none")
  const [target, setTarget] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const published = useQuery({
    ...articlesListQuery({ status: "published", pageSize: 100 }),
    enabled: old === "article",
  })
  const options = (published.data?.items ?? [])
    .filter((item) => item.id !== id)
    .map((item) => ({
      value: `/insights/${item.slug}`,
      label: item.title,
    }))
  const redirectTo =
    old === "insights" ? "/insights" : old === "article" ? target : null
  const unpublish = useMutation({
    mutationFn: () =>
      exclusive((version) =>
        parseResponse(
          articlesApi[":id"].unpublish.$post({
            param: { id },
            json: { version, archive, redirectTo },
          })
        )
      ),
    onSuccess: (result) => {
      onOpenChange(false)
      toast.success(archive ? "Archived" : "Unpublished")
      onDone(result as { version: number; status: "draft" | "archived" })
    },
    onError: (failure) => {
      const conflict = conflictOf(failure)
      if (conflict) {
        onOpenChange(false)
        return onConflict(conflict)
      }
      setError(
        failure instanceof ApiError
          ? (failure.fieldErrors?.redirectTo?.[0] ?? failure.message)
          : failure.message
      )
    },
  })
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        if (old === "article" && !target) {
          setError("Choose the article to redirect to")
          return
        }
        unpublish.mutate()
      }}
    >
      <FieldGroup>
        <Field orientation="horizontal">
          <Switch
            id="unpublish-archive"
            checked={archive}
            onCheckedChange={setArchive}
          />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="unpublish-archive">Archive instead</FieldLabel>
            <FieldDescription>
              Archived articles leave the list&apos;s default view but keep
              their history.
            </FieldDescription>
          </div>
        </Field>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">Old address</legend>
          <RadioGroup
            aria-label="Old address"
            value={old}
            onValueChange={(next) => setOld(next as OldAddress)}
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="none" /> Show not found
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="insights" /> Redirect to Insights
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="article" /> Redirect to another article
            </label>
          </RadioGroup>
          {old === "article" ? (
            <Field>
              <FieldLabel htmlFor="unpublish-article">Article</FieldLabel>
              <Select
                items={options}
                value={target}
                onValueChange={(next) => setTarget(String(next))}
              >
                <SelectTrigger id="unpublish-article" className="w-full">
                  <SelectValue
                    placeholder={published.isPending ? "Loading…" : "Choose…"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {options.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Redirects are permanent (301). You can change them later in SEO ›
            Redirects.
          </p>
        </fieldset>
      </FieldGroup>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          className={FORM_ACTION}
          disabled={unpublish.isPending}
        >
          {unpublish.isPending ? <Spinner data-icon="inline-start" /> : null}
          Unpublish
        </Button>
      </div>
    </form>
  )
}
