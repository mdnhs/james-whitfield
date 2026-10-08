import Image from "next/image"

import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { CONTACT_INFO } from "../data/contact-content"
import { ContactForm } from "./contact-form"

export function ContactSection() {
  const { eyebrow, title, subtitle, items } = CONTACT_INFO

  return (
    <section
      id="get-in-touch"
      aria-labelledby="get-in-touch-heading"
      className="bg-stone py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-12 xl:flex-row xl:items-start xl:gap-14">
        <div className="flex flex-col gap-8 xl:w-122.5 xl:shrink-0">
          <div className="flex flex-col items-start gap-4">
            <div data-motion="rise">
              <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
            </div>
            <h2
              id="get-in-touch-heading"
              data-motion="words"
              className="max-w-115 font-display text-[38px] leading-[1.2] font-bold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
            >
              {title}
            </h2>
            <p
              data-motion="rise"
              className="max-w-118 text-base leading-[1.6] text-[#525252]"
            >
              {subtitle}
            </p>
          </div>

          <ul
            data-motion="stagger"
            className="flex flex-col gap-3 md:grid md:grid-cols-2 xl:flex"
          >
            {items.map(({ icon, label, value, href }) => {
              const body = (
                <>
                  <span className="flex shrink-0 rounded-xl bg-mist p-3 transition-colors duration-300 group-hover:bg-brand-mint">
                    <Image src={icon} alt="" width={22} height={22} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5 leading-[1.5]">
                    <span className="text-xs tracking-[0.72px] text-clay uppercase">
                      {label}
                    </span>
                    <span className="text-base font-medium whitespace-pre-wrap text-[#0c0c0c]">
                      {value}
                    </span>
                  </span>
                </>
              )
              const card =
                "group flex items-center gap-4 rounded-2xl bg-white py-4 pr-5 pl-4"
              return (
                <li key={label}>
                  {href ? (
                    <a
                      href={href}
                      className={`${card} transition-shadow duration-300 outline-none hover:shadow-[0_16px_32px_-20px_rgba(30,79,80,0.35)] focus-visible:ring-3 focus-visible:ring-clay/50`}
                    >
                      {body}
                    </a>
                  ) : (
                    <div className={card}>{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <ContactForm />
      </Container>
    </section>
  )
}
