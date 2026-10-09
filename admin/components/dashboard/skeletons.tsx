import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// bg-skeleton, not the default bg-muted: muted is nearly the panel's own
// grey, so the placeholders vanished on it in both themes.
export function KpiRowSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="rounded-card bg-skeleton h-[164px]" />
      ))}
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      aria-hidden
      className={cn("rounded-card bg-skeleton h-72", className)}
    />
  )
}
