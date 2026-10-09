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
      className="relative flex w-[min(381.75px,85vw)] shrink-0 snap-start flex-col overflow-clip rounded-2xl bg-white"
    >
      <div className="relative h-54 w-full shrink-0 overflow-clip">
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

      <div className="flex flex-col items-start gap-3.5 pt-6 pr-6 pb-7 pl-6.5">
        <span className="flex size-7.5 items-center justify-center rounded-full bg-clay font-geist text-[13px] leading-[normal] font-semibold text-white">
          {index + 1}
        </span>
        <h3 className="font-geist text-[19px] leading-[1.3] font-semibold tracking-[-0.2px] text-ink">
          {title}
        </h3>
        <p className="text-[14.5px] leading-[1.65] text-text-muted">
          {description}
        </p>
      </div>
    </li>
  )
}
