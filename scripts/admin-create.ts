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
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(closeDb)
