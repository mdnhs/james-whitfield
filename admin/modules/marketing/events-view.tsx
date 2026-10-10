"use client"

import { PageHeader } from "@/admin/components/dashboard/page-header"
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
        description="What the site sends to the dataLayer. GTM decides what reaches GA4 and Meta, and only after consent."
      />
      <div className="overflow-x-auto rounded-xl border">
        <Table>
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
      <p className="text-sm text-muted-foreground">
        Import docs/gtm-container.json into GTM to get these tags and triggers.
      </p>
    </div>
  )
}
