"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { currentPage, pushPage, track } from "@/lib/tracking/track"

// One virtual_page_view per pathname change. nuqs updates only the search with
// replaceState, which never changes usePathname, so filters do not count.
export function RouteTracker() {
  const pathname = usePathname()
  useEffect(() => {
    // After a client navigation the new document.title lands a frame later.
    const frame = requestAnimationFrame(() => {
      const page = currentPage()
      pushPage(page)
      track({
        event: "virtual_page_view",
        params: {
          page_location: page.location,
          page_path: page.path,
          page_title: page.title,
        },
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname])
  return null
}
