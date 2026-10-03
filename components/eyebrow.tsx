import Image from "next/image"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const eyebrowVariants = cva(
  "inline-flex items-center gap-2.25 overflow-clip rounded-full py-2.25 pr-4 pl-3.5 text-[13px] leading-[normal] font-medium tracking-[0.4px] whitespace-nowrap",
  {
    variants: {
      tone: {
        onDark: "border border-white/10 bg-[rgba(231,239,238,0.05)] text-white",
        onLight: "bg-[#d9e5e5] text-brand-deep",
      },
    },
    defaultVariants: { tone: "onLight" },
  }
)

const DOT_SRC = {
  onDark: "/images/hero/dot.svg",
  onLight: "/images/about/dot.svg",
} as const

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
      <Image src={DOT_SRC[tone ?? "onLight"]} alt="" width={6} height={6} />
      <span>{children}</span>
    </div>
  )
}
