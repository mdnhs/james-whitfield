import Image from "next/image"

import type { Testimonial } from "../data/testimonials"

export function TestimonialCard({ quote, name, role, avatar }: Testimonial) {
  return (
    <figure className="flex flex-col gap-[42px] rounded-xl bg-stone p-6 text-ink sm:p-9">
      <blockquote className="text-lg leading-7.5 sm:text-xl">{quote}</blockquote>
      <figcaption className="flex items-center gap-4.5">
        <Image
          src={avatar}
          alt=""
          width={60}
          height={60}
          className="size-15 shrink-0 rounded-full"
        />
        <span className="flex flex-col">
          <span className="text-xl leading-7.5">{name}</span>
          <span className="text-base leading-6 opacity-60">{role}</span>
        </span>
      </figcaption>
    </figure>
  )
}
