"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { toast } from "sonner"

import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { usePermission } from "@/admin/lib/actor-context"
import { leadsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button, buttonVariants } from "@/components/ui/button"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  BOARD_STATUSES,
  UTM_KEYS,
  type ConsentRecord,
} from "@/lib/leads/schema"
import { cn } from "@/lib/utils"

import { LeadTimeline } from "./lead-timeline"
import {
  formatWhen,
  isLeadStatus,
  spamReasonLabel,
  statusLabel,
  statusTone,
  topicLabel,
} from "./present"
import { assigneesQuery, leadDetailQuery, type LeadDetail } from "./queries"
import { useUpdateLead } from "./use-update-lead"

const UNASSIGNED = "__none__"

const STATUS_ITEMS = BOARD_STATUSES.map((value) => ({
  value,
  label: statusLabel(value),
}))

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

const ACTION_LINK = cn(
  buttonVariants({ variant: "outline" }),
  "h-10 rounded-xl"
)

// The enquiry in a right-hand sheet. `id` is the URL's ?lead= value, so the
// notification email can open it directly.
export function LeadDrawer({
  id,
  onClose,
}: {
  id: string | null
  onClose(): void
}) {
  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {id ? <DrawerBody key={id} id={id} onClose={onClose} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function DrawerBody({ id, onClose }: { id: string; onClose(): void }) {
  const detail = useQuery(leadDetailQuery(id))
  if (detail.isPending) {
    return (
      <SheetHeader>
        <SheetTitle>Enquiry</SheetTitle>
        <SheetDescription>Loading…</SheetDescription>
      </SheetHeader>
    )
  }
  if (detail.isError) {
    return (
      <SheetHeader>
        <SheetTitle>Enquiry</SheetTitle>
        <SheetDescription role="alert">{detail.error.message}</SheetDescription>
      </SheetHeader>
    )
  }
  return <Detail lead={detail.data} onClose={onClose} />
}

function Detail({ lead, onClose }: { lead: LeadDetail; onClose(): void }) {
  const canUpdate = usePermission({ lead: ["update"] })
  const canErase = usePermission({ lead: ["delete"] })
  const assignees = useQuery(assigneesQuery(canUpdate))
  const update = useUpdateLead()
  const consent = (lead.consent ?? {}) as ConsentRecord
  const isSpam = lead.status === "spam"
  const assigneeItems = [
    { value: UNASSIGNED, label: "Unassigned" },
    ...(assignees.data?.items ?? []).map((p) => ({
      value: p.id,
      label: p.name,
    })),
  ]
  // An assignee who is no longer assignable still needs a label.
  if (
    lead.assignee &&
    !assigneeItems.some((i) => i.value === lead.assignee!.id)
  )
    assigneeItems.push({ value: lead.assignee.id, label: lead.assignee.name })
  const nameOf = (userId: string | null) =>
    assigneeItems.find((i) => i.value === userId)?.label
  const utm = UTM_KEYS.filter((key) => lead.utm[key])

  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-lg font-semibold">{lead.name}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2">
          <StatusPill
            tone={statusTone(isLeadStatus(lead.status) ? lead.status : "new")}
          >
            {isLeadStatus(lead.status) ? statusLabel(lead.status) : lead.status}
          </StatusPill>
          <span>
            {topicLabel(lead.topicSlug)} · received {formatWhen(lead.createdAt)}
          </span>
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-6 p-4">
        {isSpam ? (
          <p className="bg-danger-soft text-danger rounded-xl p-3 text-sm">
            Held as spam: {spamReasonLabel(lead.spamReason)}.
          </p>
        ) : null}
        <Section title="Contact">
          <p className="text-sm">
            <a className="underline" href={`mailto:${lead.email}`}>
              {lead.email}
            </a>
          </p>
          {lead.phone ? (
            <p className="text-sm">
              <a
                className="underline"
                href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`}
              >
                {lead.phone}
              </a>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <a className={ACTION_LINK} href={`mailto:${lead.email}`}>
              Email
            </a>
            {lead.phone ? (
              <a
                className={ACTION_LINK}
                href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`}
              >
                Call
              </a>
            ) : null}
          </div>
        </Section>
        <Section title="Message">
          <p className="text-sm whitespace-pre-wrap">
            {lead.message || "No message."}
          </p>
        </Section>
        {canUpdate ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {isSpam ? (
              <Section title="Status">
                <Button
                  variant="outline"
                  className="w-fit"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({ id: lead.id, patch: { status: "new" } })
                  }
                >
                  Not spam
                </Button>
              </Section>
            ) : (
              <Field>
                <FieldLabel htmlFor={`status-${lead.id}`}>Status</FieldLabel>
                <Select
                  items={STATUS_ITEMS}
                  value={lead.status}
                  onValueChange={(value) =>
                    isLeadStatus(String(value)) &&
                    update.mutate({
                      id: lead.id,
                      patch: { status: String(value) as never },
                    })
                  }
                >
                  <SelectTrigger id={`status-${lead.id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor={`assignee-${lead.id}`}>Assignee</FieldLabel>
              <Select
                items={assigneeItems}
                value={lead.assignee?.id ?? UNASSIGNED}
                onValueChange={(value) =>
                  update.mutate({
                    id: lead.id,
                    patch: {
                      assignedTo: value === UNASSIGNED ? null : String(value),
                    },
                  })
                }
              >
                <SelectTrigger id={`assignee-${lead.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assigneeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}
        <Section title="Consent">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Privacy consent</dt>
            <dd>
              {lead.privacyConsentAt
                ? formatWhen(lead.privacyConsentAt)
                : "Not recorded"}
            </dd>
            <dt className="text-muted-foreground">Consent text</dt>
            <dd>{consent.privacyText ?? "Not recorded"}</dd>
            <dt className="text-muted-foreground">Marketing</dt>
            <dd>{lead.marketingConsent ? "Yes" : "No"}</dd>
          </dl>
        </Section>
        <Section title="Source">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Page</dt>
            <dd className="break-all">{lead.sourcePath || "Unknown"}</dd>
            <dt className="text-muted-foreground">Referrer</dt>
            <dd className="break-all">{lead.referrer || "Direct"}</dd>
            {utm.map((key) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="break-all">{lead.utm[key]}</dd>
              </div>
            ))}
            <dt className="text-muted-foreground">Event id</dt>
            <dd className="break-all">{lead.metaEventId ?? "None"}</dd>
          </dl>
        </Section>
        <Section title="Timeline">
          <LeadTimeline activities={lead.activities} assigneeName={nameOf} />
        </Section>
        {canUpdate ? <NoteForm leadId={lead.id} /> : null}
        {canErase ? <EraseButton lead={lead} onErased={onClose} /> : null}
      </div>
    </>
  )
}

function NoteForm({ leadId }: { leadId: string }) {
  const client = useQueryClient()
  const field = useId()
  const [body, setBody] = useState("")
  const add = useMutation({
    mutationFn: (text: string) =>
      parseResponse(
        leadsApi[":id"].notes.$post({
          param: { id: leadId },
          json: { body: text },
        })
      ),
    onSuccess: () => {
      setBody("")
      return client.invalidateQueries({
        queryKey: queryKeys.leads.detail(leadId),
      })
    },
    onError: (error) => toast.error(error.message),
  })
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (body.trim()) add.mutate(body.trim())
      }}
    >
      <Field>
        <FieldLabel htmlFor={field}>Add a note</FieldLabel>
        <Textarea
          id={field}
          value={body}
          maxLength={5000}
          rows={3}
          onChange={(event) => setBody(event.target.value)}
        />
      </Field>
      <Button
        type="submit"
        className="w-fit"
        disabled={add.isPending || !body.trim()}
      >
        Add note
      </Button>
    </form>
  )
}

function EraseButton({
  lead,
  onErased,
}: {
  lead: LeadDetail
  onErased(): void
}) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const erase = useMutation({
    mutationFn: () =>
      parseResponse(leadsApi[":id"].$delete({ param: { id: lead.id } })),
    onSuccess: () => {
      setOpen(false)
      toast.success("Enquiry erased")
      onErased()
      client.removeQueries({ queryKey: queryKeys.leads.detail(lead.id) })
      return client.invalidateQueries({ queryKey: queryKeys.leads.all })
    },
    onError: (error) => toast.error(error.message),
  })
  return (
    <>
      <Button
        variant="destructive"
        className="w-fit"
        onClick={() => setOpen(true)}
      >
        Erase
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Erase this enquiry?</DialogTitle>
            <DialogDescription>
              This permanently deletes {lead.name}&apos;s enquiry and its
              timeline. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={erase.isPending}
              onClick={() => erase.mutate()}
            >
              Erase permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
