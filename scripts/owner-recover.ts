import { parseArgs } from "node:util"

import { closeDb } from "@/server/db/client"
import { recoverOwner, RecoveryError } from "@/server/modules/users/recover"

const { values } = parseArgs({
  options: { email: { type: "string" }, confirm: { type: "boolean" } },
})

const databaseName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "")
  } catch {
    return "(unknown)"
  }
})()

if (!values.email) {
  console.error("Usage: pnpm owner:recover --email owner@example.com --confirm")
  console.error(
    "In the container: node owner-recover.cjs --email owner@example.com --confirm"
  )
  process.exit(1)
}

// Show the target first; nothing changes without an explicit --confirm.
console.log(`Target: ${values.email.trim().toLowerCase()}`)
console.log(
  `Database: ${databaseName} (SITE_ENV=${process.env.SITE_ENV ?? "unset"})`
)
console.log(
  "This will: reset two-factor, lift any ban, end every session, record an audit entry, email a password-reset link."
)

if (!values.confirm) {
  console.error("Nothing was changed. Re-run with --confirm to proceed.")
  process.exit(1)
}

recoverOwner(values.email)
  .then(({ sessionsEnded }) => {
    console.log(
      `Recovered. Two-factor was reset and ${sessionsEnded} session(s) ended.`
    )
    console.log(
      `A password-reset link was emailed to ${values.email}. After signing in, set up two-factor again.`
    )
  })
  .catch((error: unknown) => {
    console.error(error instanceof RecoveryError ? error.message : error)
    process.exitCode = 1
  })
  .finally(closeDb)
