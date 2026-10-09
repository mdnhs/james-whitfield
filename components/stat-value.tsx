import { countAttrs, statText, type StatValue as Stat } from "@/lib/count"

// Server-rendered final value; PageMotion counts up from the data attributes.
export function StatValue({
  stat,
  className,
}: {
  stat: Stat
  className?: string
}) {
  return (
    <span className={className} {...countAttrs(stat)}>
      {statText(stat)}
    </span>
  )
}
