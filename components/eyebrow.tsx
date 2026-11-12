import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Below `sm` the mobile design swaps the pill for a 16px terracotta rule and an
// uppercase mono label (`mobile: "rule"`); the hero keeps its pill everywhere.
const eyebrowVariants = cva(
  "inline-flex items-center whitespace-nowrap sm:gap-2.25 sm:rounded-full sm:py-2.25 sm:pr-4 sm:pl-3.5 sm:font-sans sm:text-[13px] sm:leading-[normal] sm:font-medium sm:tracking-[0.4px] sm:normal-case",
  {
    variants: {
      tone: {
        onDark:
          "text-mist sm:border sm:border-white/10 sm:bg-[rgba(231,239,238,0.05)] sm:text-white",
        onLight: "text-brand-deep sm:bg-mist",
      },
      mobile: {
        rule: "gap-2 font-plex-mono text-xs leading-4 font-medium tracking-[1px] uppercase",
        pill: "gap-2.25 rounded-full py-2.25 pr-4 pl-3.5 text-[13px] leading-[normal] font-medium tracking-[0.4px]",
      },
    },
    compoundVariants: [
      {
        tone: "onDark",
        mobile: "pill",
        className:
          "border border-white/10 bg-[rgba(231,239,238,0.05)] text-white",
      },
      { tone: "onLight", mobile: "pill", className: "bg-mist" },
    ],
    defaultVariants: { tone: "onLight", mobile: "rule" },
  }
)

export function Eyebrow({
  tone = "onLight",
  mobile = "rule",
  className,
  children,
}: VariantProps<typeof eyebrowVariants> & {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn(eyebrowVariants({ tone, mobile }), className)}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          mobile === "rule" && "hidden sm:block",
          tone === "onDark" ? "bg-white" : "bg-brand-deep"
        )}
      />
      {mobile === "rule" && (
        <span aria-hidden className="h-0.5 w-4 shrink-0 bg-clay sm:hidden" />
      )}
      <span>{children}</span>
    </div>
  )
}
