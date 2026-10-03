import Image from "next/image"
import Link from "next/link"

import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import enterpriseBg from "@/public/images/enterprise/enterprise-bg.png"
import { ENTERPRISE_CONTENT } from "../data/enterprise-content"
import { EnterpriseBackdrop } from "./enterprise-backdrop"

export function EnterpriseSection() {
  const { eyebrow, title, bullets, cta } = ENTERPRISE_CONTENT

  return (
    <section
      id="enterprise"
      aria-labelledby="enterprise-heading"
      className="relative flex min-h-145 items-center overflow-clip py-20"
    >
      <EnterpriseBackdrop>
        <Image
          src={enterpriseBg}
          alt=""
          fill
          sizes="100vw"
          placeholder="blur"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-pine/90" />
      </EnterpriseBackdrop>

      <Container className="relative flex flex-col items-center gap-7 text-center">
        <span
          data-motion="rise"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border-[0.8px] border-[#ececec] bg-white px-3.5 font-geist text-sm leading-4.5 tracking-[-0.28px] whitespace-nowrap text-[#315d44]"
        >
          <span aria-hidden className="size-1 rounded-full bg-[#315d44]" />
          {eyebrow}
        </span>

        <h2
          id="enterprise-heading"
          data-motion="words"
          className="max-w-214 font-display text-[34px] leading-[1.15] font-bold text-cream [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[50px]"
        >
          {title}
        </h2>

        <ul
          data-motion="stagger"
          className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-10"
        >
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-center gap-2.5 text-sm leading-[normal] whitespace-nowrap text-cream"
            >
              <span aria-hidden className="h-0.5 w-4 shrink-0 bg-clay" />
              {bullet}
            </li>
          ))}
        </ul>

        <Link
          href={cta.href}
          data-motion="rise"
          className={cn(
            buttonVariants(),
            "h-12.5 rounded-full bg-clay px-[27px] py-0 text-[15px] leading-[normal] font-semibold text-cream hover:bg-clay/90"
          )}
        >
          {cta.label}
        </Link>
      </Container>
    </section>
  )
}
