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

// ---------------------------------------------------------------------------
// Building blocks that mirror the real admin components, so a loading screen
// has the footprint of the screen it stands in for. All decorative: aria-hidden.
// ---------------------------------------------------------------------------

function Bone({ className, ...props }: React.ComponentProps<"div">) {
  return <Skeleton className={cn("bg-skeleton", className)} {...props} />
}

// PageHeader: icon tile, title, description and the button row.
export function PageHeaderSkeleton({
  icon = true,
  description = true,
  actions = 0,
}: {
  icon?: boolean
  description?: boolean
  actions?: number
}) {
  return (
    <header
      aria-hidden
      className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-3">
          {icon ? <Bone className="size-10 shrink-0 rounded-xl" /> : null}
          <Bone className="h-8 w-48 rounded-md" />
        </div>
        {description ? <Bone className="h-4 w-72 max-w-full" /> : null}
      </div>
      {actions > 0 ? (
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: actions }, (_, i) => (
            <Bone key={i} className="h-12 w-36 rounded-xl" />
          ))}
        </div>
      ) : null}
    </header>
  )
}

// A row of link tabs (InsightsTabs): icon + label pills, h-9.
export function TabBarSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden className="flex gap-1">
      {Array.from({ length: count }, (_, i) => (
        <Bone key={i} className="h-9 w-28 shrink-0 rounded-md" />
      ))}
    </div>
  )
}

// The segmented Tabs/TabsList control (h-10, rounded-xl).
export function SegmentedSkeleton({ count = 2 }: { count?: number }) {
  return (
    <Bone
      aria-hidden
      className={cn("h-10 rounded-xl", count > 2 ? "w-72" : "w-44")}
    />
  )
}

// Search + filter controls above a list.
export function ToolbarSkeleton({
  controls = 2,
  search = true,
}: {
  controls?: number
  search?: boolean
}) {
  return (
    <div aria-hidden className="flex flex-wrap items-center gap-3">
      {search ? <Bone className="h-10 w-full rounded-lg sm:w-64" /> : null}
      {Array.from({ length: controls }, (_, i) => (
        <Bone key={i} className="h-10 w-32 rounded-lg" />
      ))}
    </div>
  )
}

// DataTable: bordered card, h-12 header, rows with the trailing action icons
// (switch / edit / delete). Below sm the real table becomes a card list.
export function TableSkeleton({
  rows = 6,
  columns = 4,
  actions = 2,
  className,
}: {
  rows?: number
  columns?: number
  actions?: number
  className?: string
}) {
  return (
    <div aria-hidden className={className}>
      <ul className="flex flex-col gap-3 sm:hidden">
        {Array.from({ length: Math.min(rows, 4) }, (_, i) => (
          <li key={i} className="rounded-card flex flex-col gap-2 bg-card p-4">
            <Bone className="h-4 w-2/3" />
            <Bone className="h-3 w-1/2" />
          </li>
        ))}
      </ul>
      <div className="rounded-card hidden overflow-hidden bg-card sm:block">
        <div className="flex h-12 items-center gap-6 border-b px-4">
          {Array.from({ length: columns }, (_, i) => (
            <Bone key={i} className="h-3 w-20" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="flex items-center gap-6 border-b px-4 py-3 last:border-b-0"
          >
            {Array.from({ length: columns }, (_, col) => (
              <Bone
                key={col}
                className={cn("h-4", col === 0 ? "w-48" : "w-24")}
              />
            ))}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {Array.from({ length: actions }, (_, i) => (
                <Bone key={i} className="size-8 rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// A stacked list of rounded rows (revisions, sessions, legal pages).
export function ListRowsSkeleton({
  rows = 3,
  rowClassName = "h-16",
}: {
  rows?: number
  rowClassName?: string
}) {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Bone key={i} className={cn("rounded-xl", rowClassName)} />
      ))}
    </div>
  )
}

// Labelled fields inside a card (SchemaForm / DashboardCard forms).
export function FormCardSkeleton({
  fields = 4,
  title = true,
  className,
}: {
  fields?: number
  title?: boolean
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-card flex min-w-0 flex-col gap-5 bg-card p-5 sm:p-6",
        className
      )}
    >
      {title ? <Bone className="h-6 w-40" /> : null}
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Bone className="h-4 w-24" />
          <Bone className="h-10 rounded-lg" />
        </div>
      ))}
      <Bone className="h-11 w-28 rounded-xl" />
    </div>
  )
}

// Media library: upload drop zone, toolbar, then the tile grid.
export function MediaGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <ul
      aria-hidden
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex flex-col gap-2">
          <Bone className="aspect-square w-full rounded-lg" />
          <Bone className="h-4 w-2/3" />
        </li>
      ))}
    </ul>
  )
}

// Chat inbox: chats list beside the open thread (lg:grid-cols-[22rem_1fr]).
export function TwoPaneSkeleton() {
  return (
    <div
      aria-hidden
      className="rounded-card grid h-[calc(var(--content-h)-4rem)] min-h-96 overflow-hidden border bg-card lg:grid-cols-[22rem_1fr]"
    >
      <div className="flex min-h-0 flex-col border-r">
        <div className="border-b p-3">
          <SegmentedSkeleton />
        </div>
        <ChatRowsSkeleton />
      </div>
      <div className="hidden min-h-0 flex-col lg:flex">
        <ThreadSkeleton />
      </div>
    </div>
  )
}

// An open chat: header, a few bubbles, the composer.
export function ThreadSkeleton() {
  return (
    <div aria-hidden className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b p-4">
        <Bone className="size-9 rounded-full" />
        <Bone className="h-5 w-48" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Bone className="h-12 w-2/5 rounded-2xl" />
        <Bone className="h-12 w-1/2 self-end rounded-2xl" />
        <Bone className="h-12 w-1/3 rounded-2xl" />
      </div>
      <div className="border-t p-3">
        <Bone className="h-11 rounded-xl" />
      </div>
    </div>
  )
}

// The inbox's own rows: name + time, a preview line, tags.
export function ChatRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul aria-hidden className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex flex-col gap-2 border-b px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-10" />
          </div>
          <Bone className="h-3 w-3/4" />
        </li>
      ))}
    </ul>
  )
}

// The page-builder / article editor: header, then block list, form and
// preview columns (xl:grid-cols-[272px_1fr_1.1fr]).
export function EditorLayoutSkeleton({ columns = 3 }: { columns?: 2 | 3 }) {
  return (
    <div aria-hidden className="flex flex-col gap-6" aria-busy>
      <div className="flex items-center justify-between gap-4">
        <PageHeaderSkeleton icon={false} />
        <div className="flex gap-2">
          <Bone className="size-10 rounded-lg" />
          <Bone className="h-10 w-28 rounded-lg" />
        </div>
      </div>
      <div
        className={cn(
          "grid gap-5",
          columns === 3
            ? "xl:grid-cols-[272px_minmax(0,1fr)_minmax(0,1.1fr)]"
            : "xl:grid-cols-[minmax(0,1fr)_340px]"
        )}
      >
        {columns === 3 ? (
          <div className="rounded-card flex flex-col gap-2 bg-card p-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Bone key={i} className="h-11 rounded-lg" />
            ))}
          </div>
        ) : null}
        <FormCardSkeleton fields={5} />
        <FormCardSkeleton fields={columns === 3 ? 5 : 3} />
      </div>
    </div>
  )
}

// A whole screen: header, optional toolbar, then the body.
export function PageSkeleton({
  children,
  header,
  className,
}: {
  children: React.ReactNode
  header?: React.ReactNode
  className?: string
}) {
  return (
    <div aria-hidden aria-busy className={cn("flex flex-col gap-6", className)}>
      {header}
      {children}
    </div>
  )
}
