export function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <li
      data-motion="tilt"
      data-tilt="8"
      className="relative flex flex-col gap-1.5 overflow-clip rounded-[14px] bg-stone py-4.5 pr-4.5 pl-5"
    >
      <span
        data-motion="count"
        className="font-geist text-[22px] leading-[1.2] font-semibold tracking-[-0.4px] whitespace-nowrap text-brand-deep"
      >
        {value}
      </span>
      <span className="text-[13.5px] leading-[1.5] text-ink-muted">
        {label}
      </span>
    </li>
  )
}
