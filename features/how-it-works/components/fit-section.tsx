import Image from "next/image"

import type { BlockView } from "@/blocks/media-refs"
import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { pairRows } from "@/lib/layout-math"
import { cn } from "@/lib/utils"

function Mark({ good }: { good: boolean }) {
  return good ? (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-pine">
      <Image
        src="/images/services/icon-check-light.svg"
        alt=""
        width={11.1571}
        height={8.20216}
      />
    </span>
  ) : (
    <Image
      src="/images/how-it-works/icon-cross.svg"
      alt=""
      width={24}
      height={24}
      className="shrink-0"
    />
  )
}

function Item({ good, children }: { good: boolean; children: string }) {
  return (
    <span className="flex items-center gap-3 text-lg leading-[1.4] font-medium tracking-[-0.18px] text-[#021019]">
      <Mark good={good} />
      {children}
    </span>
  )
}

const divider = "w-0.5 bg-clay/20"

export function FitSection({
  id,
  content,
}: {
  id: string
  content: BlockView<"fit">
}) {
  const { eyebrow, title, subtitle, good, poor } = content
  const rows = pairRows(good.items, poor.items)

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-cream py-12 sm:bg-white sm:py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-5 sm:gap-14">
        <header className="flex flex-col items-start gap-3 text-left sm:items-center sm:text-center">
          <div data-motion="rise">
            <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
          </div>
          <h2
            id={`${id}-heading`}
            data-motion="words"
            className="max-w-145 font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-forest [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px] sm:leading-[1.2] sm:tracking-normal sm:text-pine"
          >
            {title}
          </h2>
          <p
            data-motion="rise"
            className="max-w-113.5 text-[15px] leading-5.75 text-[#686561] sm:text-base sm:leading-[1.6] sm:text-text-muted"
          >
            {subtitle}
          </p>
        </header>

        {/* Desktop: a side-by-side comparison, one pair per row. */}
        <table className="hidden w-full border-separate border-spacing-0 lg:table">
          <thead>
            <tr className="text-left text-[32px] leading-[1.2] font-semibold text-brand">
              <th scope="col" className="pb-15">
                {good.heading}
              </th>
              <td aria-hidden className="w-4 pb-15" />
              <td aria-hidden className={`${divider} pb-15`} />
              <th scope="col" className="pb-15 pl-14">
                {poor.heading}
              </th>
            </tr>
          </thead>
          <tbody data-motion="stagger">
            {rows.map(([yes, no], i) => (
              <tr
                key={i}
                className="group bg-stone transition-colors duration-300 hover:bg-mist/60"
              >
                <td
                  className={`border-y border-l border-line-faint p-9 pr-0 ${i === 0 ? "rounded-tl-3xl" : ""} ${i === rows.length - 1 ? "rounded-bl-3xl" : ""}`}
                >
                  {yes !== null && <Item good>{yes}</Item>}
                </td>
                <td aria-hidden className="w-4 border-y border-line-faint" />
                <td aria-hidden className="border-y border-line-faint py-6">
                  <span className={`block h-full min-h-8 ${divider}`} />
                </td>
                <td
                  className={`border-y border-r border-line-faint p-9 pl-14 ${i === 0 ? "rounded-tr-3xl" : ""} ${i === rows.length - 1 ? "rounded-br-3xl" : ""}`}
                >
                  {no !== null && <Item good={false}>{no}</Item>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tablet: the two lists one after the other. Phones: each list is a
            card (pine for the good fit) with compact rows. */}
        <div className="flex flex-col gap-3.5 sm:gap-10 lg:hidden">
          {[good, poor].map((list, n) => {
            const yes = n === 0
            return (
              <div
                key={list.heading}
                className={cn(
                  "flex flex-col gap-3.5 rounded-[22px] px-5 py-5.5 sm:gap-5 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0",
                  yes ? "bg-pine" : "border border-line bg-white"
                )}
              >
                <h3
                  className={cn(
                    "text-xl leading-6.5 font-semibold tracking-[-0.2px] sm:text-2xl sm:leading-[1.2] sm:tracking-normal sm:text-brand",
                    yes ? "text-cream" : "text-ink"
                  )}
                >
                  {list.heading}
                </h3>
                <ul
                  data-motion="stagger"
                  className="flex flex-col gap-3.5 sm:gap-0 sm:overflow-clip sm:rounded-3xl"
                >
                  {list.items.map((item, i) => (
                    <li
                      key={i}
                      className="sm:border sm:border-line-faint sm:bg-stone sm:p-6"
                    >
                      <span
                        className={cn(
                          "flex items-start gap-3 text-[15px] leading-5.75 sm:hidden",
                          yes ? "text-cream" : "text-ink-muted"
                        )}
                      >
                        {yes ? (
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-clay">
                            <Image
                              src="/images/services/icon-check-light.svg"
                              alt=""
                              width={11.1571}
                              height={8.20216}
                            />
                          </span>
                        ) : (
                          <span
                            aria-hidden
                            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-stone text-xs text-ink-muted"
                          >
                            ×
                          </span>
                        )}
                        {item}
                      </span>
                      <span className="hidden sm:block">
                        <Item good={yes}>{item}</Item>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
