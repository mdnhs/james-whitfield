import { MediaImage } from "@/components/media-image"
import { frameStyle } from "@/lib/content/frame"
import type { ProcessStepView } from "@/lib/content/types"

export function StepCard({
  step,
  index,
}: {
  step: ProcessStepView
  index: number
}) {
  const { title, description, image, frame } = step

  return (
    <li
      data-motion="tilt"
      data-tilt="5"
      className="relative flex w-70 shrink-0 snap-start flex-col overflow-clip rounded-[20px] bg-white sm:w-[min(381.75px,85vw)] sm:rounded-2xl"
    >
      <div className="relative h-44 w-full shrink-0 overflow-clip sm:h-54">
        <div className="absolute" style={frameStyle(frame)}>
          <MediaImage
            media={image}
            alt=""
            fill
            sizes="520px"
            blur
            draggable={false}
            className="object-cover"
          />
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 px-4.5 pt-4.5 pb-5.5 sm:gap-3.5 sm:pt-6 sm:pr-6 sm:pb-7 sm:pl-6.5">
        <span className="rounded-full bg-clay/12 px-2.5 py-1.25 font-plex-mono text-xs leading-4 font-medium tracking-[1px] text-clay uppercase sm:hidden">
          Step {index + 1}
        </span>
        <span className="hidden size-7.5 items-center justify-center rounded-full bg-clay font-geist text-[13px] leading-[normal] font-semibold text-white sm:flex">
          {index + 1}
        </span>
        <h3 className="font-geist text-xl leading-6.5 font-semibold tracking-[-0.2px] text-ink sm:text-[19px] sm:leading-[1.3]">
          {title}
        </h3>
        <p className="text-[15px] leading-5.75 text-[#686561] sm:text-[14.5px] sm:leading-[1.65] sm:text-text-muted">
          {description}
        </p>
      </div>
    </li>
  )
}
