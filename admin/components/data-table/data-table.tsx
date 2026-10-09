"use client"

import type {
  ReactTable,
  Row,
  RowData,
  TableFeatures,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

// Headless TanStack Table v9 instance in, Evergreen table out. Below 640px
// rows become cards (docs/brief.md §9.4).
export function DataTable<
  TFeatures extends TableFeatures,
  TData extends RowData,
>({
  table,
  caption,
  empty,
  renderCard,
  isFetching = false,
}: {
  table: ReactTable<TFeatures, TData>
  caption: string
  empty: React.ReactNode
  renderCard: (row: Row<TFeatures, TData>) => React.ReactNode
  isFetching?: boolean
}) {
  const rows = table.getRowModel().rows
  if (rows.length === 0) return <>{empty}</>
  return (
    <div
      aria-busy={isFetching || undefined}
      className={cn(
        "flex flex-col gap-3 transition-opacity",
        isFetching && "opacity-70"
      )}
    >
      <ul aria-label={caption} className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-card bg-card p-4">
            {renderCard(row)}
          </li>
        ))}
      </ul>
      <div className="rounded-card hidden overflow-hidden bg-card sm:block">
        <Table>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id} scope="col" className="h-12 px-4">
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className="px-4 py-3">
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
