import {
  CardSkeleton,
  KpiRowSkeleton,
} from "@/admin/components/dashboard/skeletons"

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <KpiRowSkeleton />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  )
}
