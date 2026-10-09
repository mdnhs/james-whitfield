// "Good morning, Magda" with the button pair (docs/brief.md §9.3).
export const PRIMARY_ACTION =
  "h-12 gap-2 rounded-xl px-5 text-[15px] font-semibold"
export const SECONDARY_ACTION =
  "h-12 gap-2 rounded-xl border-primary px-5 text-[15px] font-semibold text-primary hover:bg-accent hover:text-accent-foreground"

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  titleTestId,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  breadcrumbs?: React.ReactNode
  titleTestId?: string
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        {breadcrumbs}
        <h1 className="text-title text-balance" data-testid={titleTestId}>
          {title}
        </h1>
        {description ? (
          <p className="text-[15px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </header>
  )
}
