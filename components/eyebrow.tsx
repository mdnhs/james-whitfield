import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const eyebrowVariants = cva(
  "inline-flex items-center gap-2.25 rounded-full py-2.25 pr-4 pl-3.5 text-[13px] leading-[normal] font-medium tracking-[0.4px] whitespace-nowrap",
  {
    variants: {
      tone: {
        onDark: "border border-white/10 bg-[rgba(231,239,238,0.05)] text-white",
        onLight: "bg-mist text-brand-deep",
      },
    },
    defaultVariants: { tone: "onLight" },
  }
)

export function Eyebrow({
  tone = "onLight",
  className,
  children,
}: VariantProps<typeof eyebrowVariants> & {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn(eyebrowVariants({ tone }), className)}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "onDark" ? "bg-white" : "bg-brand-deep"
        )}
      />
      <span>{children}</span>
    </div>
  )
}
