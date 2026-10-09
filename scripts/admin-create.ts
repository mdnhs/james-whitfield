import { parseArgs } from "node:util"

import { closeDb } from "@/server/db/client"
import { createOwner } from "@/server/modules/users/bootstrap"

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" } },
})

if (!values.email || !values.name) {
  console.error(
    'Usage: pnpm admin:create --email you@example.com --name "Your Name"'
  )
  console.error("Run `pnpm db:migrate` first if the database is new.")
  process.exit(1)
}

createOwner({ email: values.email, name: values.name })
  .then(() => {
    console.log(
      `Owner created. A set-password link was sent to ${values.email}.`
    )
    console.log("With EMAIL_DRIVER=log the link is printed above.")
  })
  .catch((error: unknown) => {
    const messages: string[] = []
    let missingRelation = false
    for (let e: unknown = error, i = 0; e && i < 5; i++) {
      messages.push(e instanceof Error ? e.message : String(e))
      if ((e as { code?: unknown }).code === "42P01") missingRelation = true
      e = (e as { cause?: unknown }).cause
    }
    console.error(messages.join("\n  caused by: "))
    if (missingRelation) console.error("Run `pnpm db:migrate` first.")
    process.exitCode = 1
  })
  .finally(closeDb)
