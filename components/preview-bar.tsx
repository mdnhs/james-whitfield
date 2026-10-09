"use client"

import { usePathname } from "next/navigation"

// Rendered by SiteFrame only while isPreviewing(). Leaving preview is a
// plain navigation (the exit endpoint clears the cookie and redirects back),
// so the public site never fetches /api.
export function PreviewBar() {
  const pathname = usePathname()
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-4 z-[100] mx-auto flex w-fit items-center gap-3 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg"
    >
      <span>Previewing unpublished changes</span>
      <a
        href={`/api/v1/admin/preview/exit?path=${encodeURIComponent(pathname)}`}
        className="font-semibold underline underline-offset-4"
      >
        Exit preview
      </a>
    </div>
  )
}
