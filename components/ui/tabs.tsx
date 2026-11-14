"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { motion } from "motion/react"
import * as React from "react"

// Each Tabs instance gets its own layoutId namespace so two tab sets on one
// screen never share an indicator.
const TabsIdContext = React.createContext("tabs")

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  const id = React.useId()
  return (
    <TabsIdContext.Provider value={id}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        className={cn(
          "group/tabs flex gap-2 data-horizontal:flex-col",
          className
        )}
        {...props}
      />
    </TabsIdContext.Provider>
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-xl p-1 text-muted-foreground group-data-horizontal/tabs:h-10 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

const SLIDE = { duration: 0.2, ease: "easeOut" } as const

function TabsTrigger({
  className,
  children,
  ...props
}: TabsPrimitive.Tab.Props) {
  const id = React.useContext(TabsIdContext)
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative isolate inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-lg border border-transparent px-3.5 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-colors group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "bg-transparent data-active:text-foreground dark:data-active:text-foreground",
        className
      )}
      {...props}
      render={(tabProps, state) => (
        <button {...tabProps}>
          {/* The active pill (default variant) or underline (line variant) is
              one shared element that slides to the new tab, not a style each
              trigger swaps. It renders on the server for the initial tab, so
              there is no flash. Under reduced motion MotionConfig makes it
              jump instead. */}
          {state.active ? (
            <motion.span
              aria-hidden
              layoutId={`${id}-indicator`}
              transition={SLIDE}
              className={cn(
                "pointer-events-none absolute -z-10",
                "-inset-px rounded-lg border border-transparent bg-background shadow-sm dark:border-input dark:bg-input/30",
                "group-data-[variant=line]/tabs-list:inset-auto group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-0 group-data-[variant=line]/tabs-list:bg-foreground group-data-[variant=line]/tabs-list:shadow-none dark:group-data-[variant=line]/tabs-list:bg-foreground",
                "group-data-[variant=line]/tabs-list:group-data-horizontal/tabs:inset-x-0 group-data-[variant=line]/tabs-list:group-data-horizontal/tabs:bottom-[-5px] group-data-[variant=line]/tabs-list:group-data-horizontal/tabs:h-0.5",
                "group-data-[variant=line]/tabs-list:group-data-vertical/tabs:inset-y-0 group-data-[variant=line]/tabs-list:group-data-vertical/tabs:-right-1 group-data-[variant=line]/tabs-list:group-data-vertical/tabs:w-0.5"
              )}
            />
          ) : null}
          {children}
        </button>
      )}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        // A short fade and rise when a panel mounts; off under reduced motion.
        "flex-1 animate-in text-sm duration-200 ease-out fade-in-0 outline-none slide-in-from-bottom-1 motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
