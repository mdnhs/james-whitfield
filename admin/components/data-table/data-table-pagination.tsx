"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { formatNumber } from "@/admin/components/dashboard/format"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"

export function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p aria-live="polite" className="text-muted-foreground tabular-nums">
        {total === 0
          ? "No entries"
          : `${first}–${last} of ${formatNumber(total)}`}
      </p>
      <ButtonGroup>
        <Button
          variant="outline"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon aria-hidden />
        </Button>
        <Button
          variant="outline"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon aria-hidden />
        </Button>
      </ButtonGroup>
    </nav>
  )
}
