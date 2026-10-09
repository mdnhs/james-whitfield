import { getAuth } from "@/server/auth/auth"
import { closeDb } from "@/server/db/client"
import { runMigrations } from "@/server/db/migrate"
import { E2E_ENV } from "@/tests/e2e/fixtures/env"
import { E2E_USERS, PASSWORD } from "@/tests/e2e/fixtures/users"
import { resetDb } from "@/tests/integration/helpers/db"
import { assertDisposableDatabase } from "@/tests/integration/helpers/guard"

// Always the E2E database, whatever the shell has. The guard still refuses
// any database whose name does not end in _e2e or _test.
Object.assign(process.env, E2E_ENV)

// Fresh, migrated E2E database with one user per scenario.
async function main() {
  assertDisposableDatabase(E2E_ENV.DATABASE_URL)
  await runMigrations(E2E_ENV.DATABASE_URL)
  await resetDb()
  for (const user of Object.values(E2E_USERS)) {
    await getAuth().api.createUser({ body: { ...user, password: PASSWORD } })
  }
  console.log(`Seeded ${Object.keys(E2E_USERS).length} E2E users.`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(closeDb)
