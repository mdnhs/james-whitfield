import Image from "next/image"

import type { Step } from "../data/steps"

export function StepCard({ step, index }: { step: Step; index: number }) {
  const { title, description, image, crop } = step

  return (
    <li
      data-motion="tilt"
      data-tilt="5"
      className="relative flex w-[min(381.75px,85vw)] shrink-0 snap-start flex-col overflow-clip rounded-2xl bg-white"
    >
      <div className="relative h-54 w-full shrink-0 overflow-clip">
        <div className="absolute" style={crop}>
          <Image
            src={image}
            alt=""
            fill
            sizes="520px"
            placeholder="blur"
            draggable={false}
            className="object-cover"
          />
        </div>
      </div>

      <div className="flex flex-col items-start gap-3.5 pt-6 pr-6 pb-7 pl-6.5">
        <span className="flex size-7.5 items-center justify-center rounded-full bg-clay font-geist text-[13px] leading-[normal] font-semibold text-white">
          {index + 1}
        </span>
        <h3 className="font-geist text-[19px] leading-[1.3] font-semibold tracking-[-0.2px] text-ink">
          {title}
        </h3>
        <p className="text-[14.5px] leading-[1.65] text-[#525252]">
          {description}
        </p>
      </div>
    </li>
  )
}
