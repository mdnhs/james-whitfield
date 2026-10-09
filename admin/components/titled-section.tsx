"use client"

import { useId } from "react"

// A region named by its own heading. A client component on purpose: useId in
// a Server Component restarts per request (every page gets the same id), and
// Cache Components keeps hidden routes in the DOM under <Activity>, so two
// pages' headings would collide and aria-labelledby would name the wrong one.
export function TitledSection({
  title,
  className,
  titleClassName,
  children,
}: {
  title: React.ReactNode
  className?: string
  titleClassName?: string
  children: React.ReactNode
}) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className={className}>
      <h1 id={titleId} className={titleClassName}>
        {title}
      </h1>
      {children}
    </section>
  )
}
