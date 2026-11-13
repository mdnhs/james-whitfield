import { Skeleton } from "@/components/ui/skeleton"

const COLUMNS = 4

// The board while its columns load: a header and a few cards per column.
export function LeadsBoardSkeleton() {
  return (
    <div aria-hidden className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: COLUMNS }, (_, col) => (
        <div key={col} className="rounded-card flex flex-col gap-2 bg-card p-3">
          <Skeleton className="bg-skeleton mb-1 h-5 w-24" />
          {[0, 1, 2].map((card) => (
            <Skeleton key={card} className="bg-skeleton h-20 rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  )
}
