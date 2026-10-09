import { cacheLife } from "next/cache"

// A bare `new Date()` fails prerendering under Cache Components. Captured in a
// cache scope, the year lands in the static shell and refreshes daily.
export async function CopyrightYear() {
  "use cache"
  cacheLife("days")
  return <>{new Date().getFullYear()}</>
}
