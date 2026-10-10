import "server-only"

import { after } from "next/server"

// Work after the response (docs/brief.md §5.5(d) step 4). Failures are logged,
// never surfaced: the visitor's request already succeeded.
export function defer(task: () => Promise<unknown>, label: string) {
  after(() =>
    task().catch((error) => console.error(`[defer] ${label} failed`, error))
  )
}
