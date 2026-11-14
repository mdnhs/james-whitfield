"use client"

import { AnimatePresence, motion } from "motion/react"
import { usePathname } from "next/navigation"

// Enter-only page transition for the content panel: a short fade and 6px
// rise when the route changes. There is no exit animation on purpose: by the
// time the pathname changes the `children` prop is already the new page's RSC
// payload, so an exit would only replay the new content (and hold Suspense
// boundaries open). `initial={false}` on the presence keeps the first paint
// and SSR output identical to a plain div, so there is no flash or CLS.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
