import { cn } from "@/lib/utils"

// Site content column: 1440px max with the design's 66px desktop gutter and
// the mobile design's 20px gutter.
export function Container({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-360 px-5 sm:px-6 lg:px-16.5",
        className
      )}
      {...props}
    />
  )
}
