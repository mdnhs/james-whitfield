import pg from "pg"

import { E2E_ENV } from "../fixtures/env"

// Puts an account back to "no two-factor", so a spec that sets it up can be
// rerun (or retried) without a fresh seed.
export async function resetTwoFactor(email: string) {
  const client = new pg.Client({ connectionString: E2E_ENV.DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      "delete from two_factors where user_id = (select id from users where email = $1)",
      [email]
    )
    await client.query(
      "update users set two_factor_enabled = false where email = $1",
      [email]
    )
  } finally {
    await client.end()
  }
}
