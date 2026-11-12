import type { BlockView } from "@/blocks/media-refs"
import { Container } from "@/components/layout/container"
import { StatValue } from "@/components/stat-value"

// Full class names so Tailwind can see them.
const COLUMNS: Record<number, string> = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
}

export function StatsBand({
  id,
  content,
}: {
  id: string
  content: BlockView<"about.stats">
}) {
  const { stats } = content
  const columns = COLUMNS[stats.length] ?? "lg:grid-cols-4"
  return (
    <section
      id={id}
      aria-label="Practice in numbers"
      className="bg-pine py-8 sm:bg-stone sm:py-12 lg:py-16"
    >
      <Container>
        <ul
          data-motion="deal-group"
          // Mobile: a 2×2 grid of translucent cards on pine. sm+: rules sit
          // between columns, every second item, then every item after the
          // first on desktop.
          className={`grid grid-cols-2 items-start gap-3 sm:gap-x-0 sm:gap-y-8 ${columns} sm:[&>li:nth-child(even)]:border-l sm:[&>li:nth-child(even)]:pl-5 lg:[&>li:nth-child(even)]:pl-8 lg:[&>li:nth-child(odd):not(:first-child)]:border-l lg:[&>li:nth-child(odd):not(:first-child)]:pl-8`}
        >
          {stats.map(({ value, label }, i) => (
            <li
              key={i}
              className="flex flex-col gap-1 rounded-[18px] border border-white/15 bg-white/8 px-4 py-4.5 sm:gap-2 sm:rounded-none sm:border-0 sm:border-line-rule sm:bg-transparent sm:px-0 sm:py-2 sm:pr-5 lg:pr-8"
            >
              <StatValue
                stat={value}
                className="font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-cream [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px] sm:leading-[1.1] sm:font-semibold sm:tracking-normal sm:text-forest"
              />
              <span className="text-[13px] leading-4.75 text-mist sm:text-base sm:leading-[1.5] sm:text-ink-muted">
                {label}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
