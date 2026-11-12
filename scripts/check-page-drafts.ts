// Read-only: lists every page whose draft publish would refuse, so broken
// drafts (often in hidden sections or anchors, which the editor can't
// reach) are repaired before editors meet them. Exits 1 if any fail.
//   pnpm pages:check-drafts           (reads DATABASE_URL from .env)
import { Pool } from "pg"

import { failingDrafts, type DraftRow } from "./check-page-drafts-lib"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("Set DATABASE_URL.")
    return 1
  }
  const pool = new Pool({ connectionString: url })
  try {
    const { rows } = await pool.query<DraftRow>(
      `select path, system_key as "systemKey", draft from pages order by path`
    )
    const failing = failingDrafts(rows)
    for (const page of failing) {
      console.log(`${page.path}${page.systemKey ? ` (${page.systemKey})` : ""}`)
      for (const error of page.errors) console.log(`  ${error}`)
    }
    console.log(
      `${rows.length} page(s) checked, ${failing.length} draft(s) would fail publish.`
    )
    return failing.length > 0 ? 1 : 0
  } finally {
    await pool.end()
  }
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 2
  }
)
