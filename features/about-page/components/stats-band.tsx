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
      className="bg-stone py-12 lg:py-16"
    >
      <Container>
        <ul
          data-motion="deal-group"
          // Rules sit between columns: every second item on mobile, every
          // item after the first on desktop.
          className={`grid grid-cols-2 gap-y-8 ${columns} [&>li:nth-child(even)]:border-l [&>li:nth-child(even)]:pl-5 lg:[&>li:nth-child(even)]:pl-8 lg:[&>li:nth-child(odd):not(:first-child)]:border-l lg:[&>li:nth-child(odd):not(:first-child)]:pl-8`}
        >
          {stats.map(({ value, label }, i) => (
            <li
              key={i}
              className="flex flex-col gap-2 border-line-rule py-2 pr-5 lg:pr-8"
            >
              <StatValue
                stat={value}
                className="font-display text-[40px] leading-[1.1] font-semibold text-forest [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
              />
              <span className="text-[15px] leading-[1.5] text-ink-muted sm:text-base">
                {label}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
