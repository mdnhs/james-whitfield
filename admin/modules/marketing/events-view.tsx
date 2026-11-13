"use client"

import { FileJsonIcon } from "lucide-react"

import { InfoHint } from "@/admin/components/actions/icon-tip"
import { PageHeader } from "@/admin/components/dashboard/page-header"
import { subnavIcon } from "@/admin/components/shell/nav-icons"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EVENT_CATALOGUE } from "@/lib/tracking/events"

export function EventsView() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Event catalogue"
        icon={subnavIcon("marketing-events")}
        description={
          <span className="inline-flex items-center gap-1">
            What the site sends to the dataLayer.
            <InfoHint id="events-catalogue-hint">
              GTM decides what reaches GA4 and Meta, and only after consent.
            </InfoHint>
          </span>
        }
      />
      <div className="rounded-card bg-card p-2 sm:p-3">
        <Table scrollLabel="Event catalogue">
          <TableHeader>
            <TableRow>
              <TableHead>dataLayer event</TableHead>
              <TableHead>Fires when</TableHead>
              <TableHead>Params</TableHead>
              <TableHead>GA4</TableHead>
              <TableHead>Meta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {EVENT_CATALOGUE.map((e) => (
              <TableRow key={e.event}>
                <TableCell className="font-mono text-sm">{e.event}</TableCell>
                <TableCell className="whitespace-normal">
                  {e.firesWhen}
                </TableCell>
                <TableCell className="font-mono text-xs whitespace-normal">
                  {e.params.join(", ")}
                </TableCell>
                <TableCell className="whitespace-normal">{e.ga4}</TableCell>
                <TableCell className="whitespace-normal">{e.meta}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <FileJsonIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Import docs/gtm-container.json into GTM to get these tags and
          triggers.
        </span>
      </p>
    </div>
  )
}
