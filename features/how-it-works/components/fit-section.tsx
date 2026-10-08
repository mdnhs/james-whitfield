import Image from "next/image"

import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { FIT } from "../data/session"

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

export function FitSection() {
  const { eyebrow, title, subtitle, good, poor } = FIT
  const rows = good.items.map((item, i) => [item, poor.items[i]] as const)

  return (
    <section aria-labelledby="fit-heading" className="bg-white py-20 lg:py-30">
      <Container className="flex flex-col gap-14">
        <header className="flex flex-col items-center gap-3 text-center">
          <div data-motion="rise">
            <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
          </div>
          <h2
            id="fit-heading"
            data-motion="words"
            className="max-w-145 font-display text-[38px] leading-[1.2] font-bold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
          >
            {title}
          </h2>
          <p
            data-motion="rise"
            className="max-w-113.5 text-base leading-[1.6] text-[#525252]"
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
                key={yes}
                className="group bg-stone transition-colors duration-300 hover:bg-mist/60"
              >
                <td
                  className={`border-y border-l border-[#f2f2f2] p-9 pr-0 ${i === 0 ? "rounded-tl-3xl" : ""} ${i === rows.length - 1 ? "rounded-bl-3xl" : ""}`}
                >
                  <Item good>{yes}</Item>
                </td>
                <td aria-hidden className="w-4 border-y border-[#f2f2f2]" />
                <td aria-hidden className="border-y border-[#f2f2f2] py-6">
                  <span className={`block h-full min-h-8 ${divider}`} />
                </td>
                <td
                  className={`border-y border-r border-[#f2f2f2] p-9 pl-14 ${i === 0 ? "rounded-tr-3xl" : ""} ${i === rows.length - 1 ? "rounded-br-3xl" : ""}`}
                >
                  <Item good={false}>{no}</Item>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile and tablet: the two lists one after the other. */}
        <div className="flex flex-col gap-10 lg:hidden">
          {[good, poor].map((list, n) => (
            <div key={list.heading} className="flex flex-col gap-5">
              <h3 className="text-2xl leading-[1.2] font-semibold text-brand">
                {list.heading}
              </h3>
              <ul
                data-motion="stagger"
                className="flex flex-col overflow-clip rounded-3xl"
              >
                {list.items.map((item) => (
                  <li
                    key={item}
                    className="border border-[#f2f2f2] bg-stone p-6"
                  >
                    <Item good={n === 0}>{item}</Item>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
