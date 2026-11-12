import { StatValue } from "@/components/stat-value"
import type { StatValue as Stat } from "@/lib/count"

export function StatCard({ stat }: { stat: { value: Stat; label: string } }) {
  const { value, label } = stat
  return (
    <li
      data-motion="tilt"
      data-tilt="8"
      className="relative flex min-w-0 flex-col gap-1 overflow-clip rounded-[14px] bg-stone px-2.5 py-3.5 sm:gap-1.5 sm:py-4.5 sm:pr-4.5 sm:pl-5"
    >
      <StatValue
        stat={value}
        className="font-geist text-[15px] leading-6 font-semibold text-brand-deep sm:text-[22px] sm:leading-[1.2] sm:tracking-[-0.4px] sm:whitespace-nowrap"
      />
      <span className="text-[13px] leading-4.75 text-[#686561] sm:text-[13.5px] sm:leading-[1.5] sm:text-ink-muted">
        {label}
      </span>
    </li>
  )
}
