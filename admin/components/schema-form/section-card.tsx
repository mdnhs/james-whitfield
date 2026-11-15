import { LayoutListIcon, type LucideIcon } from "lucide-react"
import { createElement, useId, type ReactNode } from "react"

// One titled card for a run of form fields: an icon chip, the title and an
// optional line of help, then the fields. The fields' grid picks one or two
// columns from the card's own width.
export function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description?: ReactNode
  icon?: LucideIcon
  children: ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className="rounded-card flex min-w-0 flex-col border bg-card text-card-foreground"
    >
      <header className="flex items-start gap-3 border-b px-4 py-3.5 sm:px-5">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-[18px]"
        >
          {createElement(icon ?? LayoutListIcon)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <h3 id={id} className="text-base leading-6 font-semibold">
            {title}
          </h3>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}
