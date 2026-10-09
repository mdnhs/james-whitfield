import { StatValue } from "@/components/stat-value"
import type { StatValue as Stat } from "@/lib/count"

export function StatCard({ stat }: { stat: { value: Stat; label: string } }) {
  const { value, label } = stat
  return (
    <li
      data-motion="tilt"
      data-tilt="8"
      className="relative flex flex-col gap-1.5 overflow-clip rounded-[14px] bg-stone py-4.5 pr-4.5 pl-5"
    >
      <StatValue
        stat={value}
        className="font-geist text-[22px] leading-[1.2] font-semibold tracking-[-0.4px] whitespace-nowrap text-brand-deep"
      />
      <span className="text-[13.5px] leading-[1.5] text-ink-muted">
        {label}
      </span>
    </li>
  )
}
