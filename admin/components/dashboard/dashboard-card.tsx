"use client"

import { useId } from "react"

import { cn } from "@/lib/utils"

// A client component for the same reason as TitledSection: a server useId
// repeats across routes that Cache Components keeps mounted under
// <Activity>, so aria-labelledby could name another page's heading.
export function DashboardCard({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "rounded-card flex min-w-0 flex-col gap-5 bg-card p-5 text-card-foreground sm:p-6",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-card-title">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}
