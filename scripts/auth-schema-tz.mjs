// Post-processes the Better Auth CLI output: the CLI emits `timestamp(name)`
// (without time zone), but every timestamp in this project is timestamptz.
import { readFileSync, writeFileSync } from "node:fs"

const file = process.argv[2] ?? "server/db/schema/auth.ts"
const source = readFileSync(file, "utf8")
const fixed = source.replace(
  /timestamp\(\s*"([a-z_]+)"\s*\)/g,
  'timestamp("$1", { withTimezone: true })'
)
if (/timestamp\(\s*"[a-z_]+"\s*\)/.test(fixed)) {
  throw new Error("auth-schema-tz: unrewritten timestamp column remains")
}
writeFileSync(file, fixed)
