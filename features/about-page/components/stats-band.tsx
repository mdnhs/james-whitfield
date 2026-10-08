import { Container } from "@/components/layout/container"
import { ABOUT_STATS } from "../data/about-page-content"

export function StatsBand() {
  return (
    <section
      aria-label="Practice in numbers"
      className="bg-stone py-12 lg:py-16"
    >
      <Container>
        <ul
          data-motion="stagger"
          className="grid grid-cols-2 gap-y-8 lg:grid-cols-4"
        >
          {ABOUT_STATS.map(({ value, label }, i) => (
            <li
              key={label}
              className={
                // Rules sit between columns: every second item on mobile,
                // every item after the first on desktop.
                i % 2 === 1
                  ? "flex flex-col gap-2 border-l border-[#d8dccf] px-5 py-2 lg:px-8"
                  : i > 0
                    ? "flex flex-col gap-2 py-2 pr-5 lg:border-l lg:border-[#d8dccf] lg:px-8"
                    : "flex flex-col gap-2 py-2 pr-5 lg:pr-8"
              }
            >
              <span
                data-motion="count"
                className="font-display text-[40px] leading-[1.1] font-semibold text-forest [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
              >
                {value}
              </span>
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
