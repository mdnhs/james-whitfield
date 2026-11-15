"use client"

import { motion } from "motion/react"
import { usePathname } from "next/navigation"
import { useState } from "react"

// Enter-only page transition for the content panel: a short fade and 6px
// rise when the route changes. The key remounts the wrapper per path, so the
// new page animates in and the old one leaves at once. No AnimatePresence:
// it kept the outgoing wrapper mounted, and by then its `children` prop is
// already the new page's RSC payload, so the page briefly rendered twice
// (two h1s, two of every form). The first path renders at rest, so the
// server output and first paint have no flash or CLS.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [firstPath] = useState(pathname)
  return (
    <motion.div
      key={pathname}
      initial={pathname === firstPath ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )
}
